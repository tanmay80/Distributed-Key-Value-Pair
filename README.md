# Distributed Key-Value Store with High Availability and Eventual Consistency

## Overview

This project implements a distributed key-value storage system with **high availability** and **eventual consistency using read repair**. The system leverages **consistent hashing**, **vector clocks**, and **quorum-based reads and writes** to distribute and replicate key-value pairs across nodes, ensuring fault tolerance and data consistency. Docker containers simulate a distributed environment.

### Key Features

- **Consistent Hashing**: Distributes key-value pairs evenly across nodes.
- **Replication**: Replicates data across multiple nodes to ensure availability.
- **Quorum-based Reads/Writes**: Uses a read quorum and write quorum to ensure consistency across nodes.
- **Eventual Consistency using read repair**: Uses read repair to handle eventual consitency. 
- **Vector Clocks**: Manages conflicts and ensures eventual consistency by tracking the version of each key-value pair across nodes.
- **Docker Integration**: Simulates distributed nodes using Docker containers.

---

## System Components

### 1. **Consistent Hashing and Node Management**

The system distributes key-value pairs to different nodes based on **consistent hashing**. Each node (represented by a Docker container) is part of a hash ring, and the key-value pairs are stored in the appropriate nodes according to their hash value.

- **Methods**:
  - `addNode(node: string)`: Adds a node to the hash ring.
  - `removeNode(node: string)`: Removes a node from the ring.
  - `getNextNNodes(key: string)`: Retrieves the next N nodes responsible for storing a key-value pair.
  - `getContainerId()`: Retrieves the container ID of the current node.

### 2. **File Storage**

Each node (container) maintains its own local key-value store using the **FileStorage** class. This store includes a **vector clock** to keep track of the version of each key-value pair. The vector clock helps detect conflicts and ensure correct updates across replicas.

#### **FileStorage Class**

The `FileStorage` class manages the storage of key-value pairs and their vector clocks. Data is stored locally in a file named `key value storage file` to persist key-value pairs across container restarts.

- **Methods**:
  - `setKeyValue(key: string, value: string, vectorClock: number[])`: 
    - Adds or updates a key-value pair in the storage along with its vector clock.
    - This method ensures the new data is persisted to the file after reading and modifying the existing storage.
  
  - `getKeyValue(key: string)`: 
    - Retrieves the value and vector clock associated with a key.
    - Returns a `Promise` that resolves to the `KeyValueData` object containing `value` and `vectorClock`, or `undefined` if the key doesn't exist.
  
  - `isKeyPresent(key: string)`: 
    - Checks if a specific key exists in the storage.

### 3. **Quorum-Based Reads and Writes**

The system ensures data consistency using **quorum-based reads and writes**:
- **Write Quorum**: Writes are successful when the data is replicated in at least two nodes.
- **Read Quorum**: Reads are successful when the most recent data is retrieved from at least two nodes.

### 4. **Vector Clocks**

To maintain **eventual consistency**, the system uses **vector clocks** to track versions of key-value pairs across nodes. This mechanism ensures that conflicting versions can be detected and resolved. The vector clock enables comparison of two replicas to determine which one is more recent or if the replicas are concurrent.

- **Methods**:
  - `compareVectorClocks(vc1: number[], vc2: number[])`: Compares two vector clocks and determines whether one is more recent, less recent, or if they are concurrent.

- **ps**: Used the most simple vector clock possible, so could have problem in most extreme cases. 

### 5. **Docker Integration**

The system simulates a distributed environment using Docker containers. Each container represents a node in the system, with its own local storage and responsibilities for managing key-value pairs.

- **Methods**:
  - `listContainers()`: Lists and maps running Docker containers to the node management system.
  - `getContainerId()`: Retrieves the Docker container ID of the current node.

---

## API Endpoints

The system exposes several API endpoints for storing and retrieving data across nodes:

1. **POST `/storeData`**: 
   - Stores a key-value pair in the distributed system.
   - Data is replicated to multiple nodes based on the write quorum.

2. **POST `/storeReplicas`**: 
   - Stores a replica of a key-value pair in a specific node.
   
3. **GET `/getData`**: 
   - Retrieves a key-value pair from the distributed system.
   - Ensures that data from the most recent replica is returned, using the read quorum.

4. **GET `/getReplicasValue`**: 
   - Retrieves the replica of a key-value pair stored in a specific node.

5. **POST `/updateReplica`**: 
   - Updates a replica with the latest key-value pair and vector clock.

---

## Running the System

### Prerequisites

- Docker installed and running.
- Node.js installed.

### Steps

1. Clone the repository.
2. Install the necessary dependencies:
   npm install
3. Build the docker image
   docker build -t my-typescript-app .
4. Up the docker container withn the image
   docker compose up -d