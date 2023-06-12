describe("double.test.js", function () {
    "use strict";

    describe("double function in global scope", function () {
        it("should return the value unmodified when fed a string", function () {
            // arrange
            var x = "a string";

            // act
            var result = window.double(x);

            // assert
            // the x ref can't be changed by the function, so we can keep using it
            // to test for unchanged.
            expect(result).toBe(x);
        });
    });
});
