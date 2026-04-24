// Async/Await
function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve('Done waiting!');
        }, ms);
    });
}

wait(1000).then((message) => {
    console.log("Method 1 (.then):", message);
});

async function runAsync() {
    const message = await wait(1500);
    console.log("Method 2 (await):", message);
}
runAsync();

async function runWithTryCatch() {
    try {
        const message = await wait(2000);
        console.log("Method 3 (try/catch):", message);
    } catch (error) {
        console.error("An error occurred:", error);
    }
}
runWithTryCatch();