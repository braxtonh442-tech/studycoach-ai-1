const cards = [
{
    front:"What is Photosynthesis?",
    back:"The process plants use to convert sunlight into chemical energy."
},
{
    front:"Where does photosynthesis occur?",
    back:"Inside chloroplasts."
},
{
    front:"What gas do plants absorb?",
    back:"Carbon dioxide."
},
{
    front:"What gas do plants release?",
    back:"Oxygen."
},
{
    front:"What pigment captures sunlight?",
    back:"Chlorophyll."
}
];

let current = 0;
let showingFront = true;

const card = document.getElementById("card");
const counter = document.getElementById("counter");
const bar = document.getElementById("bar");

function renderCard(){

    const c = cards[current];

    card.textContent = showingFront ? c.front : c.back;

    counter.textContent = `Card ${current+1} of ${cards.length}`;

    bar.max = cards.length;

    bar.value = current+1;

}

function flipCard(){

    showingFront = !showingFront;

    renderCard();

}

function nextCard(){

    if(current < cards.length-1){

        current++;

        showingFront = true;

        renderCard();

    }

}

function previousCard(){

    if(current > 0){

        current--;

        showingFront = true;

        renderCard();

    }

}

card.addEventListener("click",flipCard);

renderCard();
