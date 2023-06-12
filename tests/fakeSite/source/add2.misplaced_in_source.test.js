describe("add2.misplaced_in_source.test.js", function () {
    "use strict";

    describe("add2broken function in global scope", function () {
        it("(should FAIL) should return a value that is 2 greater than that which was pushed in", function () {
            // arrange
            var x = 5;

            // act
            var result = window.add2broken(x);

            // assert
            expect(result).toBe(7);
        });
    });
});
