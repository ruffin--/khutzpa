describe("these are not real tests", function () {
    "use strict";

    describe("double function in global scope", function () {
        it("should return a value double that pushed in", function () {
            // arrange
            var x = 5;

            // act
            var result = window.double(x);

            // assert
            expect(result).toBe(10);
        });
    });
});
