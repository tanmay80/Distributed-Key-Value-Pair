import ConsistentHashing from './index';
import express from 'express';
import bodyParser from 'body-parser';


const app = express()
const port = 8080; 
const nodes = ['node1', 'node2', 'node3', 'node4'];
const ch = new ConsistentHashing(nodes);

app.use(bodyParser.json());

var currentContainerId:string|undefined|null;

app.post('/updateReplica',async(req,res)=>{
    await ch.listContainers();
    const key= req.body.key;
    const value=req.body.value;
    const vectorClock = req.body.vectorClock;

    console.log("Inside updateReplica");
    console.log(vectorClock);

    const response=await ch.updateValueVectorAtRead(key,value,vectorClock);

    if(response===true){
        console.log("Replica Updated")
        res.send("Updated the Replicas");
        return;
    }

    res.send("Error: Not able to update!");
})

app.post('/storeReplicas',async (req,res)=>{
    await ch.listContainers();
    const key= req.body.key;
    const value=req.body.value;

    ch.addKeyValueReplicaToTheContainer(key,value);
    res.send("storedReplicas");
})

app.post('/storeData',async (req,res)=>{
    await ch.listContainers();
    const key= req.body.key;
    const value=req.body.value;
    const nodes= ch.getNextNNodes(key);

    const containers=ch.getContainers(nodes);
    console.log(nodes);
    console.log(containers);

    const response=await ch.addKeyValueToTheContainers(containers,currentContainerId,nodes,key,value);
    // const val= response.valueOf();
    
    // console.log(val);
    if(response==true){
      res.send("Your data has been stored");
      return;
    }

    res.send("Error: You data was not stored");
})

app.get('/getReplicasValue',async(req,res)=>{
    await ch.listContainers();
    const key= req.query.key;
    const response= await ch.getReplicasValues(key);
    res.send(response);
})


app.get('/getData',async (req, res) => {
  await ch.listContainers();
  const key=req.body.key;
  const nodes= ch.getNextNNodes(key);
  const containers=ch.getContainers(nodes);

  //Check if the particular key is even present or not in atleast readQuorum servers.
  //If present - check - if readQuorum is satisfied, if yes then send the value back and also make sure if a particular node has any old value that needs to be updated
  //                   - if readQuoprum is not Satisfied then return "Server Down".
  //If not present - Return key not present .

  // console.log(nodes);
  // console.log(containers);

  const response= await ch.getValue(containers,currentContainerId,nodes,key);

  if(response===true){
    res.send("Your data has been retrived");
    return;
  }
  console.log(response);
  res.send("Error: You data was not retrived");
})

app.listen(port, () => {
  console.log(`App listening on port ${port}`)
})

//Getting the containerId for the container we are currently in.




async function main() {
    try {
         // Wait for listContainers to complete
        
        // console.log('Adding nodes:', nodes);
        // const node = ch.getNode("hello");
        // const dockerId=ch.getContainer(node);
        // console.log('Node for key "hello":', node);
        // console.log('Container for the', node, ':', dockerId);

        

        ch.getContainerId().then((id) => {
          console.log('Container ID:', id);
          
          currentContainerId= id;
        });

        
        // ch.addNode('node4');
        // console.log('Added node4');
        // console.log('Node for key "myKey1":', ch.getNode('myKey1'));
        // console.log('Node for key "myKey2":', ch.getNode('myKey2'));
        // console.log('Node for key "myKey3":', ch.getNode('myKey3'));

        // ch.removeNode('node2');
        // console.log('Removed node2');
        // console.log('Node for key "myKey1":', ch.getNode('myKey1'));
        // console.log('Node for key "myKey2":', ch.getNode('myKey2'));
        // console.log('Node for key "myKey3":', ch.getNode('myKey3'));
    } catch (error) {
        console.error('Error:', error);
    }
}

main(); // Call the main function
