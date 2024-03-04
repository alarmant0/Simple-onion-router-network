import * as http from "http";
import {
  BASE_ONION_ROUTER_PORT,
  BASE_USER_PORT,
  REGISTRY_PORT,
} from "../../src/config";
import { launchNetwork } from "../../src/index";
import { GetNodeRegistryBody } from "../../src/registry/registry";
import {
  createRandomSymmetricKey,
  exportPrvKey,
  exportPubKey,
  exportSymKey,
  generateRsaKeyPair,
  importPrvKey,
  importPubKey,
  importSymKey,
  rsaDecrypt,
  rsaEncrypt,
  symDecrypt,
  symEncrypt,
} from "../../src/crypto";
const { validateEncryption } = require("./utils");

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function closeAllServers(
  servers: http.Server<
    typeof http.IncomingMessage,
    typeof http.ServerResponse
  >[]
) {
  await Promise.all(
    servers.map((server) =>
      server.close(() => {
        server.closeAllConnections();
      })
    )
  );

  await delay(100);
}

async function sendMessage(
  userPort: number,
  message: string,
  destinationUserId: number
) {
  await fetch(`http://localhost:${userPort}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      destinationUserId,
    }),
  });
}

async function getLastMessageDestination(nodePort: number) {
  const lastMessageDestination = await fetch(
    `http://localhost:${nodePort}/getLastMessageDestination`
  )
    .then((res) => res.json() as any)
    .then((json) => json?.result as number | null);

  return lastMessageDestination;
}

async function getLastReceivedEncryptedMessage(nodePort: number) {
  const lastReceivedEncryptedMessage = await fetch(
    `http://localhost:${nodePort}/getLastReceivedEncryptedMessage`
  )
    .then((res) => res.json() as any)
    .then((json) => json?.result as string | null);

  return lastReceivedEncryptedMessage;
}

async function getLastReceivedDecryptedMessage(nodePort: number) {
  const lastReceivedDecryptedMessage = await fetch(
    `http://localhost:${nodePort}/getLastReceivedDecryptedMessage`
  )
    .then((res) => res.json() as any)
    .then((json) => json?.result as string | null);

  return lastReceivedDecryptedMessage;
}

async function getPrivateKey(nodePort: number) {
  const strPrvKey = await fetch(`http://localhost:${nodePort}/getPrivateKey`)
    .then((res) => res.json())
    .then((json: any) => json.result as string);

  return strPrvKey;
}

async function getLastSentMessage(userPort: number) {
  const lastSentMessage = await fetch(
    `http://localhost:${userPort}/getLastSentMessage`
  )
    .then((res) => res.json() as any)
    .then((json) => json?.result as string | null);

  return lastSentMessage;
}
async function getLastReceivedMessage(userPort: number) {
  const lastReceivedMessage = await fetch(
    `http://localhost:${userPort}/getLastReceivedMessage`
  )
    .then((res) => res.json() as any)
    .then((json) => json?.result as string | null);

  return lastReceivedMessage;
}
async function getLastCircuit(userPort: number) {
  const circuit = await fetch(`http://localhost:${userPort}/getLastCircuit`)
    .then((res) => res.json())
    .then((json: any) => json.result as number[]);

  return circuit;
}

async function getNodeRegistry() {
  const nodes = await fetch(`http://localhost:${REGISTRY_PORT}/getNodeRegistry`)
    .then((res) => res.json() as Promise<GetNodeRegistryBody>)
    .then((json) => json.nodes);

  return nodes;
}

describe("Onion Routing", () => {
  describe("Project is setup correctly - 4 pt", () => {
    describe("Can start a specific number of nodes and users - 1 pt", () => {
      let servers: http.Server<
        typeof http.IncomingMessage,
        typeof http.ServerResponse
      >[] = [];

      afterEach(async () => {
        await closeAllServers(servers);
      });

      it("Can start 1 node and 1 user", async () => {
        servers = await launchNetwork(1, 1);

        const isNodeLive = await fetch(
          `http://localhost:${BASE_ONION_ROUTER_PORT + 0}/status`
        )
          .then((res) => res.text())
          .then((text) => text === "live");

        expect(isNodeLive).toBeTruthy();

        const isUserLive = await fetch(
          `http://localhost:${BASE_USER_PORT + 0}/status`
        )
          .then((res) => res.text())
          .then((text) => text === "live");

        expect(isUserLive).toBeTruthy();
      });

      it("Can start 10 node and 2 user", async () => {
        servers = await launchNetwork(10, 2);

        for (let index = 0; index < 10; index++) {
          const isNodeLive = await fetch(
            `http://localhost:${BASE_ONION_ROUTER_PORT + index}/status`
          )
            .then((res) => res.text())
            .then((text) => text === "live");

          expect(isNodeLive).toBeTruthy();
        }

        for (let index = 0; index < 2; index++) {
          const isUserLive = await fetch(
            `http://localhost:${BASE_USER_PORT + index}/status`
          )
            .then((res) => res.text())
            .then((text) => text === "live");

          expect(isUserLive).toBeTruthy();
        }
      });

      it("Can start 2 node and 10 user", async () => {
        servers = await launchNetwork(2, 10);

        for (let index = 0; index < 2; index++) {
          const isNodeLive = await fetch(
            `http://localhost:${BASE_ONION_ROUTER_PORT + index}/status`
          )
            .then((res) => res.text())
            .then((text) => text === "live");

          expect(isNodeLive).toBeTruthy();
        }

        for (let index = 0; index < 10; index++) {
          const isUserLive = await fetch(
            `http://localhost:${BASE_USER_PORT + index}/status`
          )
            .then((res) => res.text())
            .then((text) => text === "live");

          expect(isUserLive).toBeTruthy();
        }
      });

      it("The registry exists", async () => {
        servers = await launchNetwork(2, 10);

        const isRegistryLive = await fetch(
          `http://localhost:${REGISTRY_PORT}/status`
        )
          .then((res) => res.text())
          .then((text) => text === "live");

        expect(isRegistryLive).toBeTruthy();
      });
    });

    describe("Define simple GET routes - 1 pt", () => {
      const servers: http.Server[] = [];

      beforeAll(async () => {
        const _servers = await launchNetwork(10, 2);
        servers.push(..._servers);
      });

      afterAll(async () => {
        await closeAllServers(servers);
      });

      it("calling /getLastReceivedEncryptedMessage on a node before it received anything returns { result: null }", async () => {
        // getLastReceivedEncryptedMessage
        const lastReceivedEncryptedMessage =
          await getLastReceivedEncryptedMessage(BASE_ONION_ROUTER_PORT + 0);

        expect(lastReceivedEncryptedMessage).toBeNull();
      });

      it("calling /getLastReceivedDecryptedMessage on a node before it received anything returns { result: null }", async () => {
        // getLastReceivedDecryptedMessage
        const lastReceivedDecryptedMessage =
          await getLastReceivedDecryptedMessage(BASE_ONION_ROUTER_PORT + 9);

        expect(lastReceivedDecryptedMessage).toBeNull();
      });

      it("calling /getLastMessageDestination on a node before it received anything returns { result: null }", async () => {
        // getLastMessageDestination
        const lastMessageDestination = await getLastMessageDestination(
          BASE_ONION_ROUTER_PORT + 3
        );

        expect(lastMessageDestination).toBeNull();
      });

      it("calling /getLastMessageDestination on a node before it received anything returns { result: null }", async () => {
        // getLastMessageDestination
        const lastMessageDestination = await getLastMessageDestination(
          BASE_ONION_ROUTER_PORT + 1
        );

        expect(lastMessageDestination).toBeNull();
      });

      it("calling /getLastReceivedMessage on a user before it received anything returns { result: null }", async () => {
        // getLastReceivedMessage
        const lastReceivedMessage = await getLastReceivedMessage(
          BASE_USER_PORT + 1
        );

        expect(lastReceivedMessage).toBeNull();
      });

      it("calling /getLastSentMessage on a user before it received anything returns { result: null }", async () => {
        // getLastSentMessage
        const lastSentMessage = await getLastSentMessage(BASE_USER_PORT + 0);

        expect(lastSentMessage).toBeNull();
      });
    });

    describe("Nodes are registered on the registry - 1 pt", () => {
      const servers: http.Server[] = [];

      beforeAll(async () => {
        const _servers = await launchNetwork(10, 2);
        servers.push(..._servers);
      });

      afterAll(async () => {
        await closeAllServers(servers);
      });

      it("Each node is registered", async () => {
        const nodes = await getNodeRegistry();

        for (let index = 0; index < 10; index++) {
          const node = nodes.find((_n) => _n.nodeId === index);
          expect(node).not.toBeUndefined();
        }
      });

      it("Each node has a public key in the right format", async () => {
        const nodes = await getNodeRegistry();

        expect(nodes.length).toBe(10);

        for (let index = 0; index < 10; index++) {
          const node = nodes.find((_n) => _n.nodeId === index);

          expect(
            node !== undefined && /^[A-Za-z0-9+/]{392}$/.test(node.pubKey)
          ).toBeTruthy();
        }
      });

      it("All public keys are different", async () => {
        const nodes = await getNodeRegistry();

        const pubKeys = new Set<string>();

        for (let index = 0; index < nodes.length; index++) {
          pubKeys.add(nodes[index].pubKey);
        }

        expect(pubKeys.size).toBe(10);
      });

      it("Can get the private key of any node through the /getPrivateKey route", async () => {
        const nodes = await getNodeRegistry();

        for (let index = 0; index < nodes.length; index++) {
          const node = nodes[index];

          const strPrvKey = await getPrivateKey(
            BASE_ONION_ROUTER_PORT + node.nodeId
          );

          expect(/^[-A-Za-z0-9+/]*={0,3}$/.test(strPrvKey)).toBeTruthy();

          const prvKey = await importPrvKey(strPrvKey);

          const b64Message = btoa("hello world");

          const encrypted = await rsaEncrypt(b64Message, node.pubKey);
          const decrypted = await rsaDecrypt(encrypted, prvKey);

          // verify that the retrieved private key corresponds to the public key in the registry
          expect(decrypted).toBe(b64Message);
        }
      });
    });

    describe("Sending messages to users - 1 pt", () => {
      const servers: http.Server[] = [];

      beforeAll(async () => {
        const _servers = await launchNetwork(10, 2);
        servers.push(..._servers);
      });

      afterAll(async () => {
        await closeAllServers(servers);
      });

      it("Each user can receive a message", async () => {
        for (let index = 0; index < 2; index++) {
          const response = await fetch(
            `http://localhost:${BASE_USER_PORT + index}/message`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: "Hello user",
              }),
            }
          ).then((res) => res.text());

          expect(response).toBe("success");
        }
      });

      it("After receiving a message, a user's /getLastReceivedMessage route returns the right message", async () => {
        const randomNumber = crypto
          .getRandomValues(new Uint32Array(1))[0]
          .toString();

        const randomMessage = `Hello user, my favourite number is ${randomNumber}`;

        await fetch(`http://localhost:${BASE_USER_PORT + 0}/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: randomMessage,
          }),
        });

        const receivedMessage = await getLastReceivedMessage(
          BASE_USER_PORT + 0
        );

        expect(receivedMessage).toBe(randomMessage);
      });
    });
  });

  describe("Creating all cryptographic functions - 4pt", () => {
    it("Can generate RSA key pair - 0.5pt", async () => {
      const { publicKey, privateKey } = await generateRsaKeyPair();

      expect(publicKey).toBeTruthy();

      expect(publicKey.algorithm.name).toBe("RSA-OAEP");
      expect(privateKey.algorithm.name).toBe("RSA-OAEP");

      expect(publicKey.extractable).toBe(true);
      expect(privateKey.extractable).toBe(true);

      expect(publicKey.type).toBe("public");
      expect(privateKey.type).toBe("private");
    });

    it("Can export and import a public key - 0.25pt", async () => {
      const { publicKey } = await generateRsaKeyPair();

      const strPubKey = await exportPubKey(publicKey);

      const _publicKey = await importPubKey(strPubKey);

      const _strPubKey = await exportPubKey(_publicKey);

      expect(strPubKey).toBe(_strPubKey);
      expect(strPubKey).not.toBe("");
    });

    it("Can export and import a private key - 0.25pt", async () => {
      const { privateKey } = await generateRsaKeyPair();

      const strPrvKey = await exportPrvKey(privateKey);

      if (strPrvKey === null) throw new Error("strPrvKey is null");

      const _privateKey = await importPrvKey(strPrvKey);

      const _strPrvKey = await exportPrvKey(_privateKey);

      expect(strPrvKey).toBe(_strPrvKey);
      expect(strPrvKey).not.toBe("");
    });

    it("Can rsa encrypt and decrypt - 0pt", async () => {
      const { publicKey, privateKey } = await generateRsaKeyPair();

      const b64Message = btoa("Hello World!!");

      const encrypted = await rsaEncrypt(
        b64Message,
        await exportPubKey(publicKey)
      );
      const decrypted = await rsaDecrypt(encrypted, privateKey);

      // verify that the retrieved private key corresponds to the public key in the registry
      expect(decrypted).toBe(b64Message);
    });

    test.todo("Hidden test - Can rsa encrypt and decrypt - 1pt");

    it("Can generate symmetric key - 0.5 pt", async () => {
      const symKey = await createRandomSymmetricKey();

      expect(symKey).toBeTruthy();

      expect(symKey.algorithm.name).toBe("AES-CBC");

      expect(symKey.extractable).toBe(true);

      expect(symKey.type).toBe("secret");
    });

    it("Can export and import a symmetric key - 0.5pt", async () => {
      const symKey = await createRandomSymmetricKey();

      const strSymKey = await exportSymKey(symKey);

      const _symKey = await importSymKey(strSymKey);

      const _strSymKey = await exportSymKey(_symKey);

      expect(strSymKey).toBe(_strSymKey);
      expect(strSymKey).not.toBe("");
    });

    it("Can symmetrically encrypt and decrypt - 0pt", async () => {
      const symKey = await createRandomSymmetricKey();

      const b64Message = btoa("HelloWorld");

      const encrypted = await symEncrypt(symKey, b64Message);

      const decrypted = await symDecrypt(await exportSymKey(symKey), encrypted);

      // verify that the retrieved private key corresponds to the public key in the registry
      expect(decrypted).toBe(b64Message);
    });

    test.todo("Hidden test - Can symmetrically encrypt and decrypt - 1pt");
  });

  describe("Can forward messages through the network - 10 pt", () => {
    const servers: http.Server[] = [];

    beforeAll(async () => {
      const _servers = await launchNetwork(10, 2);
      servers.push(..._servers);
    });

    afterAll(async () => {
      await closeAllServers(servers);
    });

    it("User 0 can say Hello World! to user 1 - 4 pt", async () => {
      await sendMessage(BASE_USER_PORT + 0, "Hello World!", 1);

      const receivedMessage = await getLastReceivedMessage(BASE_USER_PORT + 1);

      expect(receivedMessage).toBe("Hello World!");

      const lastSentMessage = await getLastSentMessage(BASE_USER_PORT + 0);

      expect(lastSentMessage).toBe("Hello World!");
    });

    it("The circuit from 0 to 1 is respected - 1 pt", async () => {
      const callNumbers = new Array(10).fill(0);

      // This will be increased when grading exercises
      for (let index = 0; index < 150; index++) {
        await sendMessage(BASE_USER_PORT + 0, "Hello World", 1);

        const circuit = await getLastCircuit(BASE_USER_PORT + 0);

        expect(circuit).not.toBeUndefined();
        // circuit has 3 nodes
        expect(circuit.length).toBe(3);
        // nodes are unique
        expect(new Set(circuit).size).toBe(3);
        for (let index = 0; index < circuit.length; index++) {
          callNumbers[circuit[index]] += 1;
          expect(typeof circuit[index]).toBe("number");
        }
        // all nodes exist
        expect(Math.max(...circuit)).toBeLessThanOrEqual(9);
        expect(Math.min(...circuit)).toBeGreaterThanOrEqual(0);
      }

      const sum = callNumbers.reduce((acc, val) => acc + val, 0);
      const frequencies = callNumbers.map((val) => val / sum);

      // each node has more or less 10% occurence
      for (let index = 0; index < frequencies.length; index++) {
        const freq = frequencies[index];

        expect(freq).toBeGreaterThanOrEqual(0.05);
        expect(freq).toBeLessThanOrEqual(0.15);
      }
    });

    it("Each node in the circuit forwarded the message to the right node - 2pt", async () => {
      await sendMessage(BASE_USER_PORT + 0, "Hello world", 1);

      const circuit = await getLastCircuit(BASE_USER_PORT + 0);

      let lastDecrypted;

      for (let index = 0; index < circuit.length - 1; index++) {
        const nextDestination = await getLastMessageDestination(
          BASE_ONION_ROUTER_PORT + circuit[index]
        );

        const actualNextDestination =
          BASE_ONION_ROUTER_PORT + circuit[index + 1];
        expect(nextDestination).toBe(actualNextDestination);

        const lastReceivedEncryptedMessage =
          await getLastReceivedEncryptedMessage(
            BASE_ONION_ROUTER_PORT + circuit[index]
          );

        if (lastDecrypted) {
          expect(lastReceivedEncryptedMessage).toBe(lastDecrypted);
        }

        expect(
          lastReceivedEncryptedMessage !== null &&
            /^[A-Za-z0-9+/=]*$/.test(lastReceivedEncryptedMessage)
        ).toBeTruthy();

        const lastReceivedDecryptedMessage =
          await getLastReceivedDecryptedMessage(
            BASE_ONION_ROUTER_PORT + circuit[index]
          );

        lastDecrypted = lastReceivedDecryptedMessage;

        expect(
          lastReceivedDecryptedMessage !== null &&
            /^[A-Za-z0-9+/=]*$/.test(lastReceivedDecryptedMessage)
        ).toBeTruthy();
      }

      // last node
      {
        const lastDestination = await getLastMessageDestination(
          BASE_ONION_ROUTER_PORT + circuit[circuit.length - 1]
        );
        const actualLastDestination = BASE_USER_PORT + 1;
        expect(lastDestination).toBe(actualLastDestination);

        const lastReceivedEncryptedMessage =
          await getLastReceivedEncryptedMessage(
            BASE_ONION_ROUTER_PORT + circuit[circuit.length - 1]
          );

        expect(
          lastReceivedEncryptedMessage !== null &&
            /^[A-Za-z0-9+/=]*$/.test(lastReceivedEncryptedMessage)
        ).toBeTruthy();

        const lastReceivedDecryptedMessage =
          await getLastReceivedDecryptedMessage(
            BASE_ONION_ROUTER_PORT + circuit[circuit.length - 1]
          );
        expect(lastReceivedDecryptedMessage).toBe("Hello world");
      }

      const receivedMessage = await getLastReceivedMessage(BASE_USER_PORT + 1);

      expect(receivedMessage).toBe("Hello world");
    });

    it("The right message is passed to each node - 1pt", async () => {
      await sendMessage(
        BASE_USER_PORT + 0,
        "We are finally testing the whole decentralised network !",
        1
      );

      const circuit = await getLastCircuit(BASE_USER_PORT + 0);

      for (let index = 0; index < circuit.length - 1; index++) {
        const lastReceivedEncryptedMessage =
          await getLastReceivedEncryptedMessage(
            BASE_ONION_ROUTER_PORT + circuit[index]
          );

        const lastReceivedDecryptedMessage =
          await getLastReceivedDecryptedMessage(
            BASE_ONION_ROUTER_PORT + circuit[index]
          );

        const privateKey = await getPrivateKey(
          BASE_ONION_ROUTER_PORT + circuit[index]
        );

        const isValid = await validateEncryption(
          lastReceivedEncryptedMessage,
          lastReceivedDecryptedMessage,
          privateKey
        );

        expect(isValid).toBeTruthy();
      }
    });

    test.todo("Hidden test - the right message is passed to each node - 2pt");
  });

  describe("Hidden tests - 2 pt", () => {
    const servers: http.Server[] = [];

    beforeAll(async () => {
      const _servers = await launchNetwork(10, 2);
      servers.push(..._servers);
    });

    afterAll(async () => {
      await closeAllServers(servers);
    });

    test.todo("Hidden test - Can send an empty message - 1pt");

    test.todo("Hidden test - Edge case #2 - 1pt");
  });
});
