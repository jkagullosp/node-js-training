function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function reverse(str) {
    if (!str) return "";
    return str.split("").reverse().join("");
}

function countWords(str) {
    if (!str) return "";
    return str.trim().split(/\s+/).length;
}

function isEmail(str) {
    if (!str) return false;
    return str.includes("@") && str.includes(".") && !str.includes(" ");
}

module.exports = { capitalize, reverse, countWords, isEmail };