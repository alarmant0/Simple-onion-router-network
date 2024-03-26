import bodyParser from "body-parser";
import express from "express";
import {REGISTRY_PORT} from "../config";

export type Node = {
    nodeId: number;
    pubKey: string
};

export type RegisterNodeBody = {
    nodeId: number;
    pubKey: string;
};

export type GetNodeRegistryBody = {
    nodes: Node[];
};

const nodeRegistry: GetNodeRegistryBody = {
    nodes: [],
};

export async function launchRegistry() {
    const _registry = express();
    _registry.use(express.json());
    _registry.use(bodyParser.json());

    _registry.get("/status", (_, res) => {
        res.status(200).send("live");
    });

    // Register a node: if the node is not already registered, add it to the registry
    _registry.post("/registerNode", async (req, res) => {
        try {
            console.log("Registering node...");
            const {nodeId, pubKey} = req.body as RegisterNodeBody;
            if (!nodeRegistry.nodes.find((n) => n.nodeId === nodeId))
                nodeRegistry.nodes.push({nodeId, pubKey});
            res.status(200).send("Node registered");
        } catch (error) {
            res.status(500).send("Internal server error");
        }
    });

    // Get the whole node registry
    _registry.get("/getNodeRegistry", (_, res) => {
        try {
            console.log("Getting node registry...");
            res.status(200).send(nodeRegistry);
        } catch (error) {
            res.status(500).send("Internal server error");
        }
    });

    return _registry.listen(REGISTRY_PORT, () => {
        console.log(`registry is listening on port ${REGISTRY_PORT}`);
    });
}
