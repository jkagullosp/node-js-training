function wait(ms) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve('Done waiting!');
        }, ms);
    });
}

async function runComparison() {
    console.log("--- Starting Execution Comparison --- \n");

    console.log("Starting Sequential (One by one)...");
    console.time("Sequential Time");
    
    await wait(1000); // 1st second
    await wait(1000); // 2nd second
    await wait(1000); // 3rd second
    
    console.timeEnd("Sequential Time");
    console.log("Result: Each task waited for the previous one to finish.\n");

    console.log("Starting Parallel (All at once)...");
    console.time("Parallel Time");
    
    await Promise.all([
        wait(1000),
        wait(1000),
        wait(1000)
    ]);
    
    console.timeEnd("Parallel Time");
    console.log("Result: All tasks started at the same time and finished together.");
}

runComparison();