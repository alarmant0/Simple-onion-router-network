import bodyParser from 'body-parser';
import express from 'express';
import {BASE_ONION_ROUTER_PORT, REGISTRY_PORT} from '../config';
import {exportPrvKey, exportPubKey, generateRsaKeyPair, importPrvKey, rsaDecrypt, symDecrypt} from '../crypto';
import * as console from 'console';

export type LastMessageBody = {
    lastReceivedEncryptedMessage: string | null,
    lastReceivedDecryptedMessage: string | null,
    lastMessageDestination: number | null
}

export type LastMessageBodyRegistry = {
    lastMessageRegistry: Map<number, LastMessageBody>
}

export type PrvNode = {
    nodeId: number;
    prvKey: string | null
};

export type GetPrvNodeRegistryBody = {
    nodes: PrvNode[];
};

// CONSTANTS

const nodePrvRegistry: GetPrvNodeRegistryBody = {
    nodes: [],
};

const lastMessageRegistry: LastMessageBodyRegistry = {
    lastMessageRegistry: new Map<number, LastMessageBody>()
};

export async function simpleOnionRouter(nodeId: number) {
    const onionRouter = express();
    onionRouter.use(express.json());
    onionRouter.use(bodyParser.json());

    // Generate RSA key pair
    const keypair = await generateRsaKeyPair();
    const pubKey = await exportPubKey(keypair.publicKey);
    const privateKey = await exportPrvKey(keypair.privateKey);

    // Add node to registry
    nodePrvRegistry.nodes.push({nodeId: nodeId, prvKey: privateKey})

    onionRouter.get('/status', (_, res) => {
        res.status(200).send('live');
    });

    onionRouter.get('/getLastReceivedEncryptedMessage', (_, res) => {
        try {
            console.log('Getting last received encrypted message...');
            const node = lastMessageRegistry.lastMessageRegistry.get(nodeId);
            res.send({result: node?.lastReceivedEncryptedMessage || null});
        } catch (error) {
            res.status(500).send('An unexpected error occurred');
        }
    });

    onionRouter.get('/getLastReceivedDecryptedMessage', (_, res) => {
        try {
            console.log('Getting last received decrypted message...');
            const node = lastMessageRegistry.lastMessageRegistry.get(nodeId);
            res.send({result: node?.lastReceivedDecryptedMessage || null});
        } catch (error) {
            res.status(500).send('An unexpected error occurred');
        }
    });

    onionRouter.get('/getLastMessageDestination', (_, res) => {
        try {
            console.log('Getting last message destination...');
            const node = lastMessageRegistry.lastMessageRegistry.get(nodeId);
            res.send({result: node?.lastMessageDestination || null});
        } catch (error) {
            res.status(500).send('An unexpected error occurred');
        }
    });

    onionRouter.get('/getPrivateKey', (_, res) => {
        try {
            console.log('Getting private key...');
            const privateKeyNode = nodePrvRegistry.nodes.find(node => node.nodeId === nodeId);
            res.send({result: privateKeyNode?.prvKey || null});
        } catch (error) {
            res.status(500).send('An unexpected error occurred');
        }
    });

    onionRouter.post('/message', async (req, res) => {
        try {
            console.log('Received message...');

            const message = req.body.message;

            const privateKeyNode = await importPrvKey(
                nodePrvRegistry.nodes.find(node => node.nodeId === nodeId)?.prvKey || ''
            );

            const decryptedSymKey = await rsaDecrypt(message.slice(0, 344), privateKeyNode);
            const decryptedMessage = await symDecrypt(decryptedSymKey, message.slice(344));

            const nextDestination = parseInt(decryptedMessage.slice(0, 10));
            const nextMessage = decryptedMessage.slice(10);

            lastMessageRegistry.lastMessageRegistry.set(nodeId, {
                lastReceivedEncryptedMessage: message,
                lastReceivedDecryptedMessage: nextMessage,
                lastMessageDestination: nextDestination,
            });

            await fetch(`http://localhost:${nextDestination}/message`, {
                method: 'POST',
                body: JSON.stringify({message: nextMessage}),
                headers: {'Content-Type': 'application/json'},
            });

            return res.sendStatus(200);
        } catch (error) {
            return res.status(500).send('An unexpected error occurred');
        }
    });

    await registerNode(nodeId, pubKey);
    return onionRouter.listen(BASE_ONION_ROUTER_PORT + nodeId, () => {
        console.log(`Onion router ${nodeId} is listening on port ${BASE_ONION_ROUTER_PORT + nodeId}`);
    });
}

async function registerNode(nodeId: number, pubKey: string) {
    await fetch(`http://localhost:${REGISTRY_PORT}/registerNode`, {
        method: 'POST',
        body: JSON.stringify({nodeId, pubKey}),
        headers: {'Content-Type': 'application/json'},
    });
}
