# Step by step instructions

This document will help you to complete the unit tests. You can run `npm run test` to see the result of these tests.

Note that this file aims at providing general guidance. If there is any ambiguity, the unit tests should prevail.

## 1. Setup the project
Test: *"Can start a specific number of nodes and users"*

### 1.1 Spin up nodes

In the [./src/onionRouters/simpleOnionRouter.ts](./src/onionRouters/simpleOnionRouter.ts) file, you should implement a basic express server. Each server should listen to request on a specific port. This port should be defined as the addition of the `BASE_ONION_ROUTER_PORT` (defined in [./src/config.ts](./src/config.ts)) and the `nodeId`.

This basic express server should have a `/status/` HTTP GET route which simply responds with the string `live` when called.

### 1.2 Spin up users

In the [./src/users/user.ts](./src/users/user.ts) file you should again implement a basic express server. This time the port should be defined as the addition of the `BASE_USER_PORT` (defined in [./src/config.ts](./src/config.ts)) and the `userId`.

This basic express server should, as for nodes, have a `/status/` HTTP GET route which simply responds with the string `live` when called.

### 1.3 Spin up the registry

The registry's goal is to keep track of all nodes in the network.

In the same way as for nodes and users, the registry is a basic express server. It listens to requests on a specific port. It is defined by the `BASE_ONION_ROUTER_PORT` variable (in [./src/config.ts](./src/config.ts)).

This basic express server should, as for nodes, have a `/status/` HTTP GET route which simply responds with the string `live` when called.

## 2. Define simple GET routes
Test: *"Define simple GET routes"*

To allow this exercise to be automatically tested, it's needed to be able to request informations from nodes and users.

> Note that this is not part of implementing a privacy preserving onion routing network and, in fact, it goes pretty much against it. Again, this is to allow automatic analysis of how your algorithm works.

### 2.1 Nodes' GET routes

Nodes will receive encrypted messages, they will decrypt them, discover the next destination and forward the message to this given destination. 

This exercise needs to be able to retrieve the last received message in it's encrypted and decrypted form as well as the last message's destination. By default (before receiving anything), **they need to all be set to null**.

Implement the following HTTP GET routes for nodes.

#### `/getLastReceivedEncryptedMessage`

This route should respond with a JSON payload containing a `result` property containing the last received message in its encrypted form, this should be the value that is received by the node in the request.

**Example:**
```json
{
  "result": "A15HE2..." // encrypted message
}
```

#### `/getLastReceivedDecryptedMessage`

This route should respond with a JSON payload containing a `result` property containing the last received message in its encrypted form, this should be the value of the data that is forwarded to the next node / user.

**Example:**
```json
{
  "result": "Hello Bob" // this could also be an encrypted message since there is multiple layers of encryption
}
```

#### `/getLastMessageDestination`

This route should respond with a JSON payload containing a `result` property containing the destination (port) of the last received message. The destination can be a node or user port.

**Example:**
```json
{
  "result": 4001
}
```

### 2.2 Users' GET routes

Users will receive and send messages. 

This exercise needs to be able to retrieve the value of the last received and last sent message. By default (before receiving anything), **they need to be set to null**.

Implement the following HTTP GET routes for nodes.

#### `/getLastReceivedMessage`

This route should respond with a JSON payload containing a `result` property containing the last received message of the user.

**Example:**
```json
{
  "result": "Hello Bob"
}
```

#### `/getLastSentMessage`

This route should respond with a JSON payload containing a `result` property containing last sent message of the user.

**Example:**
```json
{
  "result": "Hello Alice"
}
```

## 3. Registring nodes on the registry
Test: *"Nodes are registered on the registry"*

Each node, after spinning up, should register itself on the node registry. This is in order for users to know which nodes exist to make onion routing circuits.

When registring, nodes should provide their ID and a string version of their public key.

For public and private key generations, see [5. creating all cryptographic functions](#5-creating-all-cryptographic-functions)

### 3.1 Allow nodes to register themselves

You should create an HTTP POST route called `/registerNode` which allows for nodes to register themselves on the registry.

The specific way nodes are registered is for you to choose.

> There is no need for long term storage like a database

### 3.2 Create a pair of private and public key for each node

Create an HTTP GET route called `/getPrivateKey` that allows the unit tests to retrieve the private key of a node.

> Note that this route compromises the security of the messages sent by the node, private keys should be kept secret. Here the goal of this route is to allow automatic testing of your implementation.

The route should respond with a JSON payload that satisfies the following typescript type:

```ts
type payload = {
  result: string // string is the base64 version of the private key
}
```

See [section 5](#5-creating-all-cryptographic-functions) for how to implement key generations and all cryptographic execution.

### 3.3 Register each node

Each node, as they are started up, should firstcreate their pair of keys and then should register themself on the registry.

### 3.4 Allow users to retrieve the registry

You should create an HTTP GET route called `/getNodeRegistry` which allows users to retrieve all nodes that previously registered itself.

This route should respond with a specific format. It should respond with a JSON payload that corresponds to the following typescript type:

```ts
type payload = {
  nodes: {
    nodeId: number;
    pubKey: string;
  }[]
}
```

## 4. Sending messages to users

Each user should be able to receive messages.

This should be done through an HTTP POST route called `/message`.

The body of requests should contain a JSON payload that satisfies the following typescript type:

```ts
type body = {
  message: string
}
```

Receiving a message should update the value returned by the `/getLastReceivedMessage` route.

## 5. Creating all cryptographic functions
Test: *"Creating all cryptographic functions"*

In the following steps, we will need to generate encryption keys, encrypt messages and decrypt messages.

The needed functions are provided in the file [./src/crypto.ts](./src/crypto.ts), you should implement each one.

The only package you should use is the "crypto" package.

Follow the instructions in the [crypto.ts](./src/crypto.ts) file.

## 6. Forwarding messages through the network

Now that the basis is setup, you need to implement the two most important components of the network.

- Enabling users to encrypt messages with the right encryption layers
- Enabling each node to decrypt their layer and forward the result to the next node

To allow for messages to travel anonymously through the network, we have two final routes to create.

### 6.1 Users' `/sendMessage` route

This exercise's automatic tests needs to be able to ask a user to send a message through the network.

This is done through an HTTP POST request to the `/sendMessage` route.

This route should accept a JSON body that satisfies the following type:

```ts
type body = {
  message: string;
  destinationUserId: number;
}
```

When receiving this request a user should, 

- create a random circuit of 3 distinct nodes with the help of the node registry
- create each layer of encryption
- forward the encrypted message to the entry node

#### Layers of encryption

Here, layers of encryption follow the principal seen in class.

For automatic validation, you should follow these rules:

- The user should create a unique symmetric key for each node of the circuit

The following steps should be repeated for each node in the circuit (also called steps): 
- The destination of each step should be encoded as a string of 10 characters with leading zeros. (example: "0000004012" means that the destination is the node 12 and the base port of nodes is 4000)
- (1) The previous value and the message should be concatenated and encrypted with the associated symmetric key
- (2) Then the symmetric key needs to be encrypted with the associated node's RSA public key
- Then, (2) should be concatenated with (1) in this order.

Finally, the result of the 3 layers of encryptions should be sent to the entry node's HTTP POST `/message` route.

### 6.2 Nodes' `/message` route

Nodes should be able to receive messages through the HTTP POST `/message` route. 

The body of requests should be JSON payload that satisfy the following typescript type:

```ts
type body = {
  message: string;
}
```

When receiving messages, nodes should decrypt the outer layer of the message, discover who the next node or user is and, finally, transfer the message to the next node.

At the end of the circuit, the decrypted message should be sent to the destination user.

## 7. Hidden tests

Some tests only have titles, others don't even have a description and are hidden.

To get the grade of 20/20, you will need to pass all tests (including hidden tests). 

To pass all tests, you should follow the instructions precisely and think about edge cases.