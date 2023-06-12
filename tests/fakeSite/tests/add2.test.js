describe("add2.test.js", function () {
    "use strict";

    describe("add2 function in global scope", function () {
        it("should return a value that is 2 greater than that which was pushed in", function () {
            // arrange
            var x = 5;

            // act
            var result = window.add2(x);

            // assert
            expect(result).toBe(7);
        });

        it("should return a value that is 2 when zero is sent", function () {
            // arrange
            var x = 0;

            // act
            var result = window.add2(x);

            // assert
            expect(result).toBe(2);
        });
    });
});
