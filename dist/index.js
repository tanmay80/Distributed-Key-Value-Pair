"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ts_md5_1 = require("ts-md5");
const dockerode_1 = __importDefault(require("dockerode"));
const promises_1 = require("fs/promises");
const axios_1 = __importDefault(require("axios"));
class ConsistentHashing {
    constructor(nodes = []) {
        this.ring = new Map();
        this.nodeContainerMap = new Map();
        this.sortedKeys = [];
        this.keyValuePair = new Map();
        nodes.forEach(node => this.addNode(node));
        this.docker = new dockerode_1.default({
            port: 8080,
            protocol: 'http',
        });
    }
    async listContainers() {
        try {
            const containers = await this.docker.listContainers();
            containers.forEach((e) => {
                this.nodeContainerMap.set(e.Names[0].slice(1), e.Id);
            });
        }
        catch (error) {
            console.error('Error listing containers:', error);
        }
    }
    async getContainerId() {
        try {
            const data = await (0, promises_1.readFile)('/proc/self/cgroup', 'utf8');
            const lines = data.split('\n');
            const parts = lines[0].split('/');
            if (parts.length > 1) {
                // Docker container ID is usually the last part of the path
                const id = parts[parts.length - 1].trim();
                if (id) {
                    return id;
                }
            }
        }
        catch (error) {
            console.error('Error reading container ID:', error);
        }
        return null;
    }
    async addKeyValueToTheContainer(containerId, currentContainerId, key, value) {
        try {
            if (!containerId) {
                return false;
            }
            else if (containerId === currentContainerId) {
                this.keyValuePair.set(key, value);
                return true;
            }
            else {
                const response = await axios_1.default.post(`http://localhost:${containerId}/storeData`, {
                    key: key,
                    value: value
                });
                return response.status === 200;
            }
        }
        catch (error) {
            console.error('Error adding key-value pair to container:', error);
            return false;
        }
        // // Inspect the container
        // const containerInfo = await container.inspect();
        // console.log('Container Info:', containerInfo);
        // // Check if the container is running
        // if (!containerInfo.State.Running) {
        //     // Start the container if it's not running
        //     await container.start();
        //     console.log(`Container ${containerId} started.`);
        // } else {
        //     console.log(`Container ${containerId} is already running.`);
        // }
        // You can also perform other operations, such as stopping the container
        // await container.stop();
        // console.log(`Container ${containerId} stopped.`);
    }
    getContainer(node) {
        if (node == null) {
            return undefined;
        }
        return this.nodeContainerMap.get(node);
    }
    hash(key) {
        return ts_md5_1.Md5.hashStr(key);
    }
    addNode(node) {
        const hash = this.hash(node);
        this.ring.set(hash, node);
        this.sortedKeys.push(hash);
        this.sortedKeys.sort();
    }
    removeNode(node) {
        const hash = this.hash(node);
        this.ring.delete(hash);
        this.sortedKeys = this.sortedKeys.filter(k => k != hash);
    }
    getNode(key) {
        if (this.ring.size == 0) {
            return null;
        }
        const hash = this.hash(key);
        for (let i = 0; i < this.sortedKeys.length; i = i + 1) {
            if (hash <= this.sortedKeys[i]) {
                return this.ring.get(this.sortedKeys[i]);
            }
        }
        return this.ring.get(this.sortedKeys[0]);
    }
}
exports.default = ConsistentHashing;
