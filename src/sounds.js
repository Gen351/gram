const Eureka = new Audio('/sounds/Eureka(Google Pixel 6a).mp3');

export function playNewMessageSound() {
    if(Eureka) {
        Eureka.play();
    } else {
        console.log('Eureka is missing');
    }
}