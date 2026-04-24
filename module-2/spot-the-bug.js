/* --- BUGGY VERSION (COMMENTED OUT) ---
function getNumber() {
  return new Promise(resolve => {
    setTimeout(() => resolve(42), 500);
  });
}

function main() {
  const number = getNumber(); // Bug: missing 'await'
  console.log('The number is:', number);
}

main();
*/

// --- FIXED VERSION ---

function getNumber() {
  return new Promise(resolve => {
    setTimeout(() => resolve(42), 500);
  });
}

async function main() {
  const number = await getNumber(); 
  console.log('The number is:', number);
}

main();