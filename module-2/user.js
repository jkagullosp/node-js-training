// Objects

const profile = {
    name: "Kyle Agullo",
    role: "Software Engineer",
    yearsOfExperience: 3,
    favoriteLanguages: ["JavaScript", "Python", "Rust"]
};

console.log(`Name: ${profile.name}`);

console.log(`First Language: ${profile["favoriteLanguages"][0]}`);

profile.isLearningNodeJS = true;

console.log("Full Profile:", profile);