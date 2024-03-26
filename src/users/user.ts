import bodyParser from 'body-parser';
import express from 'express';
import {BASE_ONION_ROUTER_PORT, BASE_USER_PORT, REGISTRY_PORT} from '../config';
import {GetNodeRegistryBody} from '../registry/registry';
import {createRandomSymmetricKey, exportSymKey, rsaEncrypt, symEncrypt} from '../crypto';
import * as console from 'console';

export type SentMessageBody = {
    message: string;
    destinationUserId: number;
};

export type ReceivedMessageBody = {
    message: string;
    destinationUserId: number;
};

export type SentMessageBodyRegistry = {
    sentMessageBodyRegistry: SentMessageBody[]
}

export type ReceivedMessageBodyRegistry = {
    receivedMessageBodyRegistry: ReceivedMessageBody[]
}

export type CircuitNode = {
    nodeId: number;
    pubKey: string;
}

export type GetLastCircuit = {
    nodes: CircuitNode[];
}

// CONSTANTS
const sendMessageBodyRegistry: SentMessageBodyRegistry = {
    sentMessageBodyRegistry: [],
};

const receivedMessageBodyRegistry: ReceivedMessageBodyRegistry = {
    receivedMessageBodyRegistry: [],
};

const lastCircuit: GetLastCircuit = {
    nodes: [],
};

let nodeRegistry: GetNodeRegistryBody = {
    nodes: [],
};

export async function user(userId: number) {
    const _user = express();
    _user.use(express.json());
    _user.use(bodyParser.json());

    nodeRegistry = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`)
        .then(response => response.json()) as GetNodeRegistryBody;

    sendMessageBodyRegistry.sentMessageBodyRegistry.push(
        {
            message: '',
            destinationUserId: userId
        }
    );

    if (!receivedMessageBodyRegistry.receivedMessageBodyRegistry.some(existingNode => existingNode.destinationUserId === userId)) {
        receivedMessageBodyRegistry.receivedMessageBodyRegistry.push({message: '', destinationUserId: userId});
    }

    _user.get('/status', (_, res) => {
        res.status(200).send('live');
    });

    _user.post('/message', (req, res) => {
        try {
            console.log('Received message...');
            const {message} = req.body;
            receivedMessageBodyRegistry.receivedMessageBodyRegistry.forEach(
                registry => {
                    if (registry.destinationUserId === userId) {
                        registry.message = message;
                    }
                }
            );
            return res.send('success');
        } catch (error) {
            return res.status(500).send('An unexpected error occurred');
        }
    });

    _user.get('/getLastReceivedMessage', (_, res) => {
        try {
            console.log('Getting last received message...');
            const message = receivedMessageBodyRegistry.receivedMessageBodyRegistry.find(
                registry => registry.destinationUserId === userId
            )
            res.status(200).send({result: message?.message || null});
        } catch (e) {
            res.status(500).send('An unexpected error occurred');
        }
    });

    _user.get('/getLastSentMessage', (_, res) => {
        try {
            const message = sendMessageBodyRegistry.sentMessageBodyRegistry.find(
                sendMessageBodyRegistry => sendMessageBodyRegistry.destinationUserId === userId
            );
            res.status(200).send({result: message?.message || null});
        } catch (error) {
            res.status(500).send('An unexpected error occurred');
        }
    });

    _user.get('/getLastCircuit', (_, res) => {
        try {
            res.send({result: lastCircuit.nodes.map(node => node.nodeId).reverse()});
        } catch (error) {
            res.status(500).send('An unexpected error occurred');
        }
    });

    _user.post('/sendMessage', async (req, res) => {
        try {
            console.log('Sending message...');
            const {message, destinationUserId} = req.body;

            const circuit = [];
            const usedIndices = new Set();
            for (let i = 0; i < 3; i++) {
                if (usedIndices.size === nodeRegistry.nodes.length) {
                    res.status(500).send('Not enough unique nodes available');
                }
                let randomIndex;
                do {
                    randomIndex = Math.floor(Math.random() * nodeRegistry.nodes.length);
                } while (usedIndices.has(randomIndex));
                usedIndices.add(randomIndex);
                circuit.push(nodeRegistry.nodes[randomIndex]);
            }
            lastCircuit.nodes = circuit;

            let encryptedMessage = message;
            let destinationUserMessage = BASE_USER_PORT + destinationUserId;

            for (const node of circuit) {
                const symmetricKey = await createRandomSymmetricKey();
                const destination = destinationUserMessage.toString().padStart(10, '0') + encryptedMessage;
                destinationUserMessage = BASE_ONION_ROUTER_PORT + node.nodeId;
                encryptedMessage =
                    await rsaEncrypt(await exportSymKey(symmetricKey), node.pubKey) + await symEncrypt(symmetricKey, destination);
            }

            await fetch(`http://localhost:${BASE_ONION_ROUTER_PORT + circuit[2].nodeId}/message`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({message: encryptedMessage}),
            });

            sendMessageBodyRegistry.sentMessageBodyRegistry.forEach(
                registry => {
                    if (registry.destinationUserId === userId) {
                        registry.message = message;
                    }
                }
            );

            res.sendStatus(200);
        } catch (error) {
            res.status(500).send('An unexpected error occurred');
        }
    });

    return _user.listen(BASE_USER_PORT + userId, () => {
        console.log(
            `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
        );
    });
}
