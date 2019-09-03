import { AzureFunction, Context } from "@azure/functions"
import parseLinkHeader from "parse-link-header";
import Octokit from "@octokit/rest";
import { getContainerClient, getEGClient } from "../shared/utils";
import { EventGridModels } from "azure-eventgrid";
import { generateUuid } from "@azure/core-http";
import { BlobDownloadResponse } from "@azure/storage-blob/typings/src/generated/lib/models";
const TOPIC_ENDPOINT = 'azure-sdk-github-events.westus2-1.eventgrid.azure.net';
const TOPIC_THINGIE = '/subscriptions/faa080af-c1d8-40ad-9cce-e1a450ca5b57/resourceGroups/bterlson-testbed/providers/Microsoft.EventGrid/topics/azure-sdk-github-events';

const ghClient = new Octokit();

// can't I just get a string of the contents?
async function getLastEvent() {
    const client = (await getContainerClient()).getBlobClient('lastEvent.txt');
    let content: BlobDownloadResponse;
    /*
    try {
        console.log('starting download');
        content = await client.download();
    } catch (e) {
        if (e.statusCode === 404) {
            return null
        }

        throw e;
    }
    */
    return client.download().then(content => {
        return new Promise((resolve) => {
            console.log('doing stream stuff');
            let str = '';
            content.readableStreamBody.on('data', (d) => {
                console.log('reading stream');
                str += d.toString('utf8');
            });
            content.readableStreamBody.on('end', () => {
                console.log('resolving');
                resolve(str);
            });
        });
    }).catch(e => {
        if (e.statusCode === 404) {
            return null
        }

        throw e;
    })
    /*
    console.log('downloaded thing');
    return new Promise((resolve) => {
            let str = '';            
            content.readableStreamBody.on('data', (d) => {
                console.log('reading stream');
                str += d.toString('utf8');
            });
            content.readableStreamBody.on('end', () => {
                console.log('resolving');
                resolve(str);
            });
    });
    */
}

async function writeLastEvent(event: string) {
    const client = await getContainerClient();
    // annoying I have to specify size here?
    await client.uploadBlockBlob('lastEvent.txt', event, event.length);
    return;
}

function delay(d: number) {
    return new Promise(r => {
        setTimeout(r, d);
    });
}

const timerTrigger: AzureFunction = async function (context: Context): Promise<void> {
    let newEvents: EventGridModels.EventGridEvent[] = [];
    context.log('getting last event');
    const lastBridgedEventId = await getLastEvent();
    context.log('looping over all activity', lastBridgedEventId);
    for await (const event of getAllActivity(context)) {
        if (event.id === lastBridgedEventId) break;
        newEvents.push(event);
    }

    if (newEvents.length === 0) {
        context.log('no new events');
        return;
    }

    context.log('writing last event');
    await writeLastEvent(newEvents[0].id);
    
    newEvents = newEvents.reverse().map(e => {
        return {
            id: generateUuid(),
            topic: TOPIC_THINGIE,
            subject: 'github-event',
            data: e,
            eventType: "github-event",
            eventTime: new Date(),
            dataVersion: "1"
        }
    })

    const egc = await getEGClient();
    const res = await egc.publishEvents(TOPIC_ENDPOINT, newEvents);
};

let lastCheck = '';
async function* getAllActivity(context) {
    let page = 1;

    const reqParams = {
        owner: 'azure',
        repo: 'azure-sdk-for-js',
        headers: {
            'If-Modified-Since': lastCheck
        }
    };

    context.log('getting activity');

    while (page <= 10) {
        context.log('getting activity for page ' + page);
        let activity: Octokit.Response<any>;

        try {
            activity = await ghClient.activity.listRepoEvents({ page, ... reqParams });
            /*activity = {
                headers: { "last-modified": "" },
                data: [
                    {id: "1"},
                    { id: "2" },
                    { id: "3" }
                ]
            } as any;*/
        } catch (e) {
            if (e.status === 304) {
                context.log('no new activity');
                return;
            } else {
                context.log(e);
                throw e;
            }
        }
        if (page === 1) {
            lastCheck = activity.headers["last-modified"];
        }

        for (const event of activity.data) {
            yield event;
        }

        const rels = parseLinkHeader(activity.headers.link);
        if (!rels || !rels['next']) {
            return;
        }
        break;
        //page++;
    }
}


export default timerTrigger;