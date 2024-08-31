import * as fs from 'fs';
import * as path from 'path';

interface KeyValueData {  // Named export for the interface
    value: string;
    vectorClock: number[];
}

class FileStorage{
    private filePath:string;

    constructor(){
        this.filePath = path.join(__dirname, "key value storage file");
        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify({}));
        }
    }

    // Method to set a key-value pair with a vector clock
    async setKeyValue(key: string, value: string, vectorClock: number[]): Promise<void> {
        const keyValuePairs = this.readFromFile();
        keyValuePairs[key] = { value, vectorClock };
        this.writeToFile(keyValuePairs);
    }

    // Method to get a value and its vector clock by key
    async getKeyValue(key: string): Promise<KeyValueData | undefined> {
        const keyValuePairs = this.readFromFile();
        return keyValuePairs[key];
    }

    async isKeyPresent(key: string): Promise<boolean> {
        const keyValuePairs = this.readFromFile();
        return key in keyValuePairs;
    }

    // Method to update the vector clock for a specific key
    async updateVectorClock(key: string, newVectorClock: number[]): Promise<void> {
        const keyValuePairs = this.readFromFile();
        if (keyValuePairs[key]) {
            keyValuePairs[key].vectorClock = newVectorClock;
            this.writeToFile(keyValuePairs);
        } else {
            throw new Error(`Key ${key} not found`);
        }
    }

    // Method to remove a key-value pair
    async removeKeyValue(key: string): Promise<void> {
        const keyValuePairs = this.readFromFile();
        if (keyValuePairs[key]) {
            delete keyValuePairs[key];
            this.writeToFile(keyValuePairs);
            console.log(`Key ${key} removed successfully.`);
        } else {
            console.log(`Key ${key} not found.`);
        }
    }


    // Method to read the file and parse its content
    private readFromFile(): { [key: string]: KeyValueData } {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(fileContent);
    }

    // Method to write key-value pairs back to the file
    private writeToFile(keyValuePairs: { [key: string]: KeyValueData }): void {
        fs.writeFileSync(this.filePath, JSON.stringify(keyValuePairs, null, 2));
    }

}

export  default FileStorage ;
