import { EventHubClient, EventHubConsumer, EventPosition } from "@azure/event-hubs"
import { BlobClient, ContainerClient } from "@azure/storage-blob";
import { DefaultAzureCredential, ManagedIdentityCredential } from "@azure/identity";
import { SecretsClient } from "@azure/keyvault-secrets";
import { Context } from "@azure/functions";
import { TopicCredentials } from "ms-rest-azure";

import EventGridClient from "azure-eventgrid";

const kvCred = new DefaultAzureCredential();
export const kvClient = new SecretsClient('https://bterlson-keyvault.vault.azure.net', kvCred);

export async function getEGClient() {
    const egcs = await kvClient.getSecret('event-grid-connection-string');
    return new EventGridClient(new TopicCredentials(egcs.value));
}

export async function getEHClient() {
    const ehcs = await kvClient.getSecret('ehcs');
    return new EventHubClient(ehcs.value);
}

export async function getContainerClient(container = 'gh-bridge') {
    const scs = await kvClient.getSecret('storagecs');
    return new ContainerClient(scs.value, container);
}

export async function allEventsIterator(client: EventHubClient) {
    const merge = (await import("ix/asynciterable/merge")).merge;
    const partitions = await client.getPartitionIds();
    const consumers: EventHubConsumer[] = [];

    for (const partition of partitions) {
        const consumer = client.createConsumer(
            EventHubClient.defaultConsumerGroupName,
            partition,
            EventPosition.latest()
        );

        consumers.push(consumer);
    }

    const iters = consumers.map(c => c.getEventIterator());
    return merge(...(iters as [any]))[Symbol.asyncIterator]() as AsyncIterableIterator<object>;
}

export async function allNewEventsIterator(client: EventHubClient, context: Context) {
    const merge = (await import("ix/asynciterable/merge")).merge;
    const partitions = await client.getPartitionIds();
    const consumers: EventHubConsumer[] = [];
    const lastSeq = new Map<string, number>();
    const iters = [];

    for (const partition of partitions) {
        const iter = getNewEventsIterator(client, partition, context);
        if (!iter) continue;
        iters.push(iter);
    }

    return merge(...(iters as [any]))[Symbol.asyncIterator]() as AsyncIterableIterator<object>;   
}

async function getNewEventsIterator(client: EventHubClient, partition: string, context: Context) {
    const props = await client.getPartitionProperties(partition);
    context.log('props for partition', partition, props);
    if (props.lastEnqueuedSequenceNumber === -1) {
        return null;
    }

    return newEventsIterator(client, partition, props.lastEnqueuedSequenceNumber, context);
}

async function* newEventsIterator(client: EventHubClient, partition: string, until: number, context: Context) {
    context.log('here?');

    const consumer = client.createConsumer(
        EventHubClient.defaultConsumerGroupName,
        partition,
        EventPosition.earliest()
    );

    for await (const event of consumer.getEventIterator()) {
        yield event;
        if (event.sequenceNumber === until) {
            break;
        }
    }
}