import { TWallpaper } from 'twallpaper'
import 'twallpaper/css'

const container = document.getElementById('my-wallpaper');
const wallpaper = new TWallpaper(container, {
  colors: ['#dbddbb', '#6ba587', '#d5d88d', '#88b884'],
  fps: 30,           // frames per second
  tails: 90,         // tail length
  animate: true,     // auto animation
  scrollAnimate: true // enable scroll interaction
});
wallpaper.init();

