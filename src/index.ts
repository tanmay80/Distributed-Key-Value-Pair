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
    private readQuorum;
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
        this.readQuorum=2;
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

    async updateValueVectorAtRead(key:string,value:string,vector:[]){

        await this.fileStorage.setKeyValue(key, value, vector);    
        const newKeyValueData = await this.fileStorage.getKeyValue(key);
            
        if (newKeyValueData) {
            console.log("New KeyValueData:", newKeyValueData);
        } else {
            console.error(`Error: Failed to set and retrieve the new key-value pair for key ${key}.`);
            return false;
        }

        return true;
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

    compareVectorClocks(vc1: number[], vc2: number[]): number {
        let isGreater = false, isLesser = false;
        console.log("Inside comapre vector clocks");
        console.log(vc1);
        for (let i = 0; i < vc1.length; i++) {
            if (vc1[i] > vc2[i]) isGreater = true;
            if (vc1[i] < vc2[i]) isLesser = true;
        }
        console.log("Inside comapre vector clocks2");
        if (isGreater && !isLesser) return 1;  // vc1 is greater
        if (isLesser && !isGreater) return -1; // vc2 is greater
        return 0;                              // They are concurrent or equal
    }
    
    
    
    async getValue(
        containersId: string[] | undefined,
        currentContainerId: string | undefined | null,
        nodes: string[] | undefined | null,
        key: string,
    ){
        try{
            if(containersId==null){
                return false;
            }else{
                let datas: any[] = new Array(containersId.length);
                let promises: Promise<any>[] = [];

                for(let i=0;i<containersId.length;i=i+1){
                    const containerId= containersId[i];

                    if (containerId === currentContainerId) {
                        const promise=await this.fileStorage.getKeyValue(key);
                        // console.log(promise+" promise");
                        datas[i]=promise;
                        // promises.push(promise);  
                        this.readQuorum--;
                    }else{
                        if(nodes!=null){
                            const node = nodes[i];
                            const promise = axios.get(`http://${node}:8080/getReplicasValue`, {
                                params: {
                                    key: key
                                }
                            })
                            .then(res=>{
                               console.log(res.data+"node :"+node);
                               datas[i]=res.data;
                               this.readQuorum--;
                            }).catch(error => {
                                console.error(`Error sending request to node ${node}`);
                                return false;
                            });;

                            promises.push(promise);
                        }
                    }

                }

                

                for (let promise of promises) {
                    const result = await promise;
                    if (this.readQuorum <= 0) {
                        console.log("ReadQuorum is 0");
                        break; // Exit if quorum is reached
                    }
                }

                if(this.readQuorum<=0){
                    
                    let latestReplica = datas[0];
                    console.log(datas.length+" Length of Datas")
                    for (let i = 1; i < datas.length; i++) {
                        // console.log("Ganduuuuuu")
                        if (latestReplica && datas[i]) { // Ensure both are not null or undefined
                            // console.log("Ganduuuuuu")
                            // console.log(latestReplica);
                            // console.log(datas[i]);
                            const comparison = this.compareVectorClocks(latestReplica.vectorClock, datas[i].vectorClock);
                            
                            if (comparison === -1) {  // data[i] has a greater vector clock
                                latestReplica = datas[i];
                            }
                        } else if (datas[i]) {  // If latestReplica is null but data[i] is not
                            latestReplica = datas[i];
                        }
                    }

                    // console.log("sadsdasd");
                    console.log(`Latest Value: ${latestReplica.value}`);
                    console.log(`Latest Vector Clock: ${latestReplica.vectorClock}`);
                    
                    
                    for(let i=0;i<datas.length;i=i+1){
                        // console.log(i);
                        if (latestReplica && datas[i]) { // Ensure both are not null or undefined
                            // console.log(latestReplica.vectorClock+" "+datas[i].vectorClock);
                            const comparison = this.compareVectorClocks(latestReplica.vectorClock, datas[i].vectorClock);

                            // console.log("aklssjdklasjdklas");

                            // console.log(comparison);

                            if (comparison === 1) {  // latestReplica has a greater vector clock
                                if(nodes!=null){
                                    const node=nodes[i];
                                    console.log("------");
                                    console.log(node);
                                    console.log(latestReplica.vectorClock);
                                    console.log(latestReplica.value);
                                    console.log("------");
                                    axios.post(`http://${node}:8080/updateReplica`, {
                                        key: key,
                                        value: latestReplica.value,
                                        vectorClock: latestReplica.vectorClock
                                    });
                                }
                            }
                        }
                    }
                    

                    return true;
                }

            }
        }catch(error){
            console.error('Error retriving key-value pair to container');
            return false;
        }
    }

    async getReplicasValues(key: any,){
        const promise=this.fileStorage.getKeyValue(key);
        return promise;
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