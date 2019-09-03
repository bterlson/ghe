import fn from './index';
import { getContainerClient, getEGClient } from '../shared/utils';

function defaultContext() {
    return {
        log: console.log.bind(console) //jest.fn()
    }
}


async function test() {
    
    const context = defaultContext();

    context.log('deleting last check');
    // delete lastCheck.txt
    const container = await getContainerClient();
    try {
        await container.deleteBlob('lastEvent.txt');
    } catch (e) { console.log('error deleting', e) };
    
    context.log('calling fn');
    const result = await fn(context as any);
    console.log('fn returned');

}


async function test2() {
    const client = await getEGClient();

}
test();