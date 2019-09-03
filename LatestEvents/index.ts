import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import { getEHClient, allNewEventsIterator } from "../shared/utils";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('HTTP trigger function processed a request.');
    const ehClient = await getEHClient();
    context.log('got eh client');

    const body = [];

    for await (const event of await allNewEventsIterator(ehClient, context)) {
        context.log('received event', event);
        body.push(event);
    }
    context.log('done!');
    context.res = body;
};

export default httpTrigger;
