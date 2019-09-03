import { EventHubClient, EventHubConsumer, EventPosition } from "@azure/event-hubs";
import { DefaultAzureCredential } from "@azure/identity";
import { SecretsClient } from "@azure/keyvault-secrets";
import { merge } from "ix/asynciterable/merge";
import { BlobClient, ContainerClient } from "@azure/storage-blob";

const kvCred = new DefaultAzureCredential();
const kvClient = new SecretsClient('https://bterlson-keyvault.vault.azure.net', kvCred);

async function getEHClient() {
    const ehcs = await kvClient.getSecret('ehcs');
    return new EventHubClient(ehcs.value);
}

async function getBlobClient() {
    const scs = await kvClient.getSecret('storagecs');
    return new BlobClient(scs.value, 'gh-bridge', 'lastEvent.txt');
}

async function getContainerClient() {
    const scs = await kvClient.getSecret('storagecs');
    return new ContainerClient(scs.value, 'gh-bridge');
}

// this is ridic. Can't I just get a damn string of the contents?
function getLastEvent() {
    return new Promise(async (resolve, reject) => {
        const client = await getBlobClient();
        try {
            let str = '';
            const content = await client.download();
            content.readableStreamBody.on('data', (d) => {
                str += d.toString('utf8');
            });
            content.readableStreamBody.on('end', () => {
                resolve(str);
            });
        } catch (e) {
            if (e.statusCode === 404) {
                resolve(null);
            }
            
            reject(e);
        }
    })
}

async function writeLastEvent() {
    const client = await getContainerClient();
    // annoying I have to specify size here?
    await client.uploadBlockBlob('lastEvent.txt', 'testing 1 2 3', 13);
    return;
}

async function deleteLastEvent() {
    const client = await getContainerClient();
    await client.deleteBlob('lastEvent.txt');
    return;
}

async function main() {
    /*
    const event = await getLastEvent();
    console.log(event);
    await writeLastEvent();
    const event2 = await getLastEvent();
    console.log(event2);
    await deleteLastEvent();
    /* */
    const client = await getEHClient();
    const partitions = await client.getPartitionIds();
    const consumers: EventHubConsumer[] = [];

    for(const partition of partitions) {
        const consumer = client.createConsumer(
            EventHubClient.defaultConsumerGroupName, 
            partition,
            EventPosition.earliest()
        );

        consumers.push(consumer);
    }
    
    const iters = consumers.map(c => c.getEventIterator());
    const merged = merge(...(iters as [any]));

    console.log('receiving');
    for await (const message of merged) {
        console.log(message);
    }
    /**/
}

async function allEventsIterator(client: EventHubClient) {
    const partitions = await client.getPartitionIds();
    const consumers: EventHubConsumer[] = [];

    for (const partition of partitions) {
        const consumer = client.createConsumer(
            EventHubClient.defaultConsumerGroupName,
            partition,
            EventPosition.earliest()
        );

        consumers.push(consumer);
    }

    const iters = consumers.map(c => c.getEventIterator());
    return merge(...(iters as [any]));
}


main();