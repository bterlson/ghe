import { AzureFunction, Context } from "@azure/functions"

const eventGridTrigger: AzureFunction = async function (context: Context, eventGridEvent: any) {
    return {
        target: 'newEvent',
        arguments: [
            eventGridEvent
        ]
    }
};

export default eventGridTrigger;
