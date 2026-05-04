const { capitalize, reverse, countWords, isEmail } = require("./string-utils");

// Two tests for capitalizing
describe("Capitalize a string", () => {
  test("Capitalize philippines", () => {
    expect(capitalize("philippines")).toBe("Philippines");
  });

  test("Returns empty string when given empty string", () => {
    expect(capitalize("")).toBe("");
  });
});


// Two tests for reverse
describe("Reverse a string", () => {
    test("Reversing Stratpoint", () => {
        expect(reverse("stratpoint")).toBe("tnioptarts");
    });
    test("Returns empty string when given empty string", () => {
        expect(reverse("")).toBe("");
    });
});

// Two tests for countWords
describe("Count words", () => {
    test("Count words on string", () => {
        expect(countWords("stratpoint")).toBe(1);
    });
    test("Multiple words separated by spaces", () => {
        expect(countWords("strat point")).toBe(2);
    });
});

// Two tests for isEmail
describe("isEmail test", () => {
    test("Check if the string is an email", () => {
        expect(isEmail("stratpoint@gmail.com")).toBe(true);
    });
    test("Spaces in email", () => {
        expect(isEmail("stratpoint @gmail.com")).toBe(false);
    });
});
