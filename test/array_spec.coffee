ex = if typeof expect isnt 'undefined' then expect else undefined
(->
    expect = ex || require 'expect.js'
    describe 'empty array', ->
        array = []
        describe 'length', ->
            it 'should be 0', ->
                expect(array.length).to.equal 0

)()
