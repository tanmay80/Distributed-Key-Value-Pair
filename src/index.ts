import { Md5, Md5FileHasher } from 'ts-md5';
import Docker from 'dockerode';
import { readFile } from 'fs/promises';
import axios from 'axios';
import { error } from 'console';
import FileStorage from './fileStorage';

// interface KeyValueData {  // Named export for the interface
//     value: string;
//     vectorClock: number[];
// }
class ConsistentHashing {

    private ring: Map<string, string>;
    private nodeContainerMap: Map<string,string>;
    private sortedKeys: string[];
    private docker;
    private writeQuorum;
    private fileStorage;
    
    constructor(nodes: string[]=[]){
        this.ring=new Map();
        this.nodeContainerMap=new Map();
        this.sortedKeys=[];
        nodes.forEach(node=>this.addNode(node));
        this.docker = new Docker({
            port: 8080,
            protocol: 'http',
        });
        this.writeQuorum=2;
        this.fileStorage=new FileStorage();
    }

    async listContainers() {
        try {
            const containers = await this.docker.listContainers();
            // console.log(containers)
            containers.forEach((e)=>{
                this.nodeContainerMap.set(e.Names[0].slice(1),e.Id);
            })
            console.log("List Containers completed!");
            // console.log(this.nodeContainerMap);
        } catch (error) {
            console.error('Error listing containers:', error);
        }
    }

    async getContainerId(): Promise<string | null> {
        try {
            const data = await readFile('/proc/self/cgroup', 'utf8');
            const lines = data.split('\n');
            
            const parts = lines[0].split('/');
            if (parts.length > 1) {
                // Docker container ID is usually the last part of the path
                const id = parts[parts.length - 1].trim();
                if (id) {
                    return id;
                }
            }
            
        } catch (error) {
            console.error('Error reading container ID:', error);
        }
        return null;
    }

    async addKeyValueReplicaToTheContainer(key: string, value: string) {
        if (await this.fileStorage.isKeyPresent(key)) {

            const keyValueData = await this.fileStorage.getKeyValue(key);
    
            if (keyValueData) { 
                console.log("KeyValueData before update:", keyValueData); 
                keyValueData.vectorClock[0] += 1;
                await this.fileStorage.setKeyValue(key, keyValueData.value, keyValueData.vectorClock);
                console.log("KeyValueData after update:", keyValueData);
            } else {
                console.error(`Error: Key ${key} is present but returned undefined data.`);
            }
        } else {
            await this.fileStorage.setKeyValue(key, value, [0, 0, 0]);
            const newKeyValueData = await this.fileStorage.getKeyValue(key);
            
            if (newKeyValueData) {
                console.log("New KeyValueData:", newKeyValueData);
            } else {
                console.error(`Error: Failed to set and retrieve the new key-value pair for key ${key}.`);
            }
    
            return true;
        }
    }
    
    
    

    async addKeyValueToTheContainers(
        containersId: string[] | undefined,
        currentContainerId: string | undefined | null,
        nodes: string[] | undefined | null,
        key: string,
        value: string
    ) {
        try {
            if (containersId == null) {
                return false;
            } else {
                let promises: Promise<boolean>[] = []; // Declare an array to hold promises
    
                for (let i = 0; i < containersId.length; i++) {
                    const containerId = containersId[i];
                
                    if (containerId === currentContainerId) {
                        this.fileStorage.setKeyValue(key,value,[0,0,0]);
                        this.writeQuorum--;
                        // No need to add a promise for this operation
                    } else {
                        if (nodes != null) {
                            const node = nodes[i]; // Directly using the loop index to get the corresponding node
                
                            const promise = axios.post(`http://${node}:8080/storeReplicas`, {
                                key: key,
                                value: value
                            }).then(res => {
                                console.log(res.data);
                                if (res.data === "storedReplicas") {
                                    this.writeQuorum--;
                                    console.log("Reached here");
                                    // Check if writeQuorum is 0 after decrement
                                    if (this.writeQuorum <= 0) {
                                        console.log("One down");
                                        return true; // Early return if quorum is reached
                                    }
                                }
                                return false;
                            }).catch(error => {
                                console.error(`Error sending request to node ${node}`);
                                return false;
                            });
                
                            promises.push(promise); // Add promise to the array
                        }
                    }
                }
                
    
                // Await the results of the promises
                for (let promise of promises) {
                    const result = await promise;
                    if (this.writeQuorum <= 0) {
                        console.log("Write Quorum is 0, total 2 places the value is stored");
                        return true; // Exit if quorum is reached
                    }
                }

                return false;
            }
        } catch (error) {
            console.error('Error adding key-value pair to container:', error);
            return false;
        }
    }
    

    getContainers(nodes: string[] | null): string[] | undefined {
        if (nodes == null) {
            return undefined;
        }
    
        let containers: string[] = [];
        nodes.forEach((node) => {
            const container = this.nodeContainerMap.get(node)!;
            console.log(container+" "+node);
            containers.push(container);
        });
    
        return containers.length > 0 ? containers : undefined;
    }
    

    private hash(key:string):string{
        return Md5.hashStr(key) as string;
    }

    addNode(node:string):void{
        const hash=this.hash(node);
        this.ring.set(hash,node);
        this.sortedKeys.push(hash);
        this.sortedKeys.sort();
    }

    removeNode(node:string):void{
        const hash=this.hash(node);
        this.ring.delete(hash);
        this.sortedKeys=this.sortedKeys.filter(k=>k!=hash);
    }

    getNextNNodes(key : string): Array<string> | null {
        if(this.ring.size == 0){
            return null;
        }
    
        const hash = this.hash(key);
        const nodes = [];
        let numberOfNodes = 3;
        let startIdx = -1;
    
        // Find the first node with a hash greater than or equal to the key's hash
        for(let i = 0; i < this.sortedKeys.length; i++){
            if(hash <= this.sortedKeys[i]){
                startIdx = i;
                break;
            }
        }
    
        // If no such node is found, start from the beginning of the ring
        if(startIdx === -1) {
            startIdx = 0;
        }
    
        let i = startIdx;
        while(numberOfNodes > 0){
            nodes.push(this.ring.get(this.sortedKeys[i])!);
            i = (i + 1) % this.sortedKeys.length;
            numberOfNodes--;
        }
    
        return nodes;
    }
    

    
}

export default ConsistentHashing;