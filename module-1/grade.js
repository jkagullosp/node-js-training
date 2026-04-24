// Conditionals

function getGrade(score) {
    if (score >= 90) {
        return 'A';
    }
    else if (score >= 80) {
        return 'B';
    }
    else if (score >= 70) {
        return 'C';
    }
    else if (score >=60) {
        return 'D';
    }
    else {
        return 'F';
    }
}

const scoresToTest = [95, 82, 74, 61, 45];
scoresToTest.forEach(score => {
    console.log(`Score: ${score} => Grade: ${getGrade(score)}`)
})