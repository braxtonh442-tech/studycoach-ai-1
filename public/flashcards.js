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
const frontText = document.getElementById("frontText");
const backText = document.getElementById("backText");
const counter = document.getElementById("counter");
const bar = document.getElementById("bar");

function renderCard(){

    const c = cards[current];

    frontText.textContent = c.front;
    backText.textContent = c.back;

    counter.textContent = `Card ${current + 1} of ${cards.length}`;

    bar.max = cards.length;
    bar.value = current + 1;

    if(showingFront){
        card.classList.remove("flipped");
    }else{
        card.classList.add("flipped");
    }

}

function flipCard(){

    showingFront = !showingFront;

    card.classList.toggle("flipped");

}

function nextCard(){

    if(current < cards.length - 1){

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
