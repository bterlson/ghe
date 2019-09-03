const signalR = require("@aspnet/signalr");
 
let connection = new signalR.HubConnectionBuilder()
    .withUrl("http://localhost:7071/api")
    .build();
 
connection.on("newEvent", data => {
    displayEvent(data);
});
 
connection.start()
    .then(() => connection.invoke("send", "Hello"));

function displayEvent(event) {
    const ghEvent = event.data;
    const actor = ghEvent.actor;
    const payload = ghEvent.payload;
    const repository = ghEvent.repo;
    const pr = payload.pull_request;

    switch (ghEvent.type) {
        case "WatchEvent":
            console.log(`${actor.display_login} starred ${repository.name}.`);
            break;
        case "PullRequestReviewCommentEvent":
            console.log(`${actor.display_login} made a review comment on #${pr.number}: ${payload.comment.html_url}`)
            break;
        default: 
            console.log('Unknown event type', ghEvent.type);
    }
}