describe("square.test.js", function () {
    "use strict";

    describe("square function in global scope", function () {
        it("should return a value that squares that which was pushed in", function () {
            // arrange
            var x = 5;

            // act
            var result = window.square(x);

            // assert
            expect(result).toBe(25);
        });
    });
});
