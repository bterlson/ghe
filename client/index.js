const signalR = require('@aspnet/signalr');

let connection = new signalR.HubConnectionBuilder()
    .withUrl("https://ghe.azurewebsites.net/api")
    .build();

connection.on("newEvent", data => {
    console.log('dispatching event');
    displayEvent(data);
});

connection.start()
    .then(() => connection.invoke("send", "Hello"));


let $app;
document.addEventListener('DOMContentLoaded', () => {
    $app = document.getElementById('app');
});
function displayEvent(event) {
    const ghEvent = event.data;
    const actor = ghEvent.actor;
    const payload = ghEvent.payload;
    const repository = ghEvent.repo;
    const pr = payload.pull_request;
    const issue = payload.issue;

    const createdAt = Date.parse(ghEvent.created_at);

    const $el = document.createElement('div');
    $el.classList.add('event');
    $el.classList.add(ghEvent.type);

    switch (ghEvent.type) {
      case "WatchEvent":
        $el.innerHTML = `
                ${formatDate(createdAt)}
                ${actor.display_login} starred ${repository.name}.
            `;
        break;
      case "PullRequestReviewCommentEvent":
        $el.innerHTML = `
                ${formatDate(createdAt)}
                ${actor.display_login} made a review comment on
                <a href="${payload.comment.html_url}">#${pr.number}</a>.
            `;
        break;
      case "IssueCommentEvent":
        $el.innerHTML = `
                ${formatDate(createdAt)}
                ${actor.display_login} commented on 
                <a href="${payload.comment.html_url}">#${issue.number}</a>.
            `;
        break;
      case "IssueEvent":
        $el.innerHTML = `
                ${formatDate(createdAt)}
                ${actor.display_login} ${payload.action} issue
                <a href="${issue.html_url}">${issue.number}</a>:
                ${issue.title}.
            `;
        break;
      case "PushEvent":
        $el.innerHTML = `
                ${formatDate(createdAt)}
                ${actor.display_login} pushed commits to ${payload.ref}.
            `;
        break;
      case "PullRequestEvent":
        $el.innerHTML = `
                ${formatDate(createdAt)}
                ${actor.display_login} ${payload.action} Pull Request
                <a href="${pr.html_url}">${pr.number}</a>:
                ${pr.title}.
            `;
        break;
      default:
        console.log(event);
    }

    $app.insertBefore($el, $app.firstChild);
}

function formatDate(date) {
    return `<span class="event-date">${(new Date(date)).toLocaleString()}</span>`;
}