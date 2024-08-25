"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = __importDefault(require("./index"));
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const app = (0, express_1.default)();
const port = 8080;
const nodes = ['node1', 'node2', 'node3'];
const ch = new index_1.default(nodes);
app.use(body_parser_1.default.json());
var currentContainerId;
app.post('/storeData', async (req, res) => {
    const key = req.body.key;
    const value = req.body.value;
    const node = ch.getNode(key);
    const container = ch.getContainer(node);
    const response = await ch.addKeyValueToTheContainer(container, currentContainerId, key, value);
    const val = response.valueOf();
    res.json(val);
    if (currentContainerId == ch.getContainer("node2")) {
        console.log("In same container");
        return res.json(currentContainerId);
    }
    else {
        console.log("In different Container");
    }
});
app.get('/getData', (req, res) => {
    res.send('Hello World!');
});
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});
//Getting the containerId for the container we are currently in.
async function main() {
    try {
        await ch.listContainers(); // Wait for listContainers to complete
        console.log('Adding nodes:', nodes);
        const node = ch.getNode("hello");
        const dockerId = ch.getContainer(node);
        console.log('Node for key "hello":', node);
        console.log('Container for the', node, ':', dockerId);
        ch.getContainerId().then((id) => {
            console.log('Container ID:', id);
            currentContainerId = id;
        });
        ch.addNode('node4');
        console.log('Added node4');
        console.log('Node for key "myKey1":', ch.getNode('myKey1'));
        console.log('Node for key "myKey2":', ch.getNode('myKey2'));
        console.log('Node for key "myKey3":', ch.getNode('myKey3'));
        ch.removeNode('node2');
        console.log('Removed node2');
        console.log('Node for key "myKey1":', ch.getNode('myKey1'));
        console.log('Node for key "myKey2":', ch.getNode('myKey2'));
        console.log('Node for key "myKey3":', ch.getNode('myKey3'));
    }
    catch (error) {
        console.error('Error:', error);
    }
}
main(); // Call the main function
