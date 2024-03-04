# simple-onion-router-network

Your goal for this exercise is to implement a version of the onion routing protocol we saw in module 5.

This repository already implements the basic structure you need for the onion routing network, your goal will be to implement the inner workings of the protocol.

Note that to simplify this implementation we won't be covering responses. This means that the network will only be used to send messages, i.e. requests shouldn't expect a response from the destination.

## The basic structure

This project has 3 components which represent the core components of the onion routing protocol:
- nodes
- users
- the nodes registry

### Nodes

They are onion routers which sole purpose is to route traffic from one node to the other, or one user to a node in the case of an entry node and from a node to a user in the case of an exit node.

### Users

They are users of the network. They can send and receive messages.

### The nodes registry

This entity holds a list of nodes, their IP addresses and their RSA public key. Any user can request this list and nodes can ask the registry to become part of this list.

## Setting up the project

You will first need to install the dependencies of the project by running `npm install` at the root of the project.

Note that the only required dependencies are already specified and no other package should be installed to complete this exercise.

Used packages are
- crypto (included with node)
- body-parser
- express

You should have Node installed at a version superior to v18.

## How to test your code

There are two ways to achieve this.

1. Run the unit tests with the command `npm run test` and see how your implementation performs against the given tests
2. Launch the network manually with `npm run start` and make http requests to nodes and users using tools like Postman or Insomnia

## Onion routing protocol

Follow the [step by step instructions](./instructions.md) to complete this workshop.

## Grading

You are graded out of 20 points based on the unit tests provided in the `__test__/tests/` directory. 

Note that not all tests are provided so you can secure a number of points but the rest will be graded after you submit the exercise.

This exercise should be completed individually, you are not allowed to reuse code from other students. Any detected instances of copied code will incur a reduction of your grade.