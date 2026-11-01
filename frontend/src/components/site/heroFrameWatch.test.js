import { watchHeroFrames } from './heroFrameWatch';
beforeEach(()=>jest.useFakeTimers());
afterEach(()=>jest.useRealTimers());
test('detects a frozen decoder even while its media clock advances',()=>{
 const recover=jest.fn();let callback;
 const video={readyState:4,paused:false,ended:false,currentTime:8,requestVideoFrameCallback:fn=>{callback=fn;return 1;},cancelVideoFrameCallback:jest.fn()};
 const stop=watchHeroFrames(video,recover,()=>true);
 callback(0,{});video.currentTime=12;jest.advanceTimersByTime(4000);
 expect(recover).toHaveBeenCalledTimes(1);stop();
});
test('does not reload a healthy, hidden, or still buffering video',()=>{
 const recover=jest.fn();let callback;let allowed=true;
 const video={readyState:4,paused:false,currentTime:1,requestVideoFrameCallback:fn=>{callback=fn;return 1;},cancelVideoFrameCallback:jest.fn()};
 const stop=watchHeroFrames(video,recover,()=>allowed);
 for(let i=0;i<8;i++){jest.advanceTimersByTime(500);callback(0,{});}
 allowed=false;jest.advanceTimersByTime(10000);allowed=true;video.readyState=1;jest.advanceTimersByTime(6000);
 expect(recover).not.toHaveBeenCalled();stop();jest.advanceTimersByTime(6000);expect(recover).not.toHaveBeenCalled();
});

test('recovers a discarded media buffer after the browser returns idle',()=>{
 const recover=jest.fn();
 const video={readyState:0,networkState:0,paused:true,currentTime:14};
 const stop=watchHeroFrames(video,recover,()=>true);
 jest.advanceTimersByTime(3500);
 expect(recover).toHaveBeenCalledTimes(1);stop();
});

test('a current frame without future data is buffering, not a broken decoder',()=>{
 const recover=jest.fn();
 const video={readyState:2,networkState:2,paused:false,currentTime:14,requestVideoFrameCallback:jest.fn(),cancelVideoFrameCallback:jest.fn()};
 const stop=watchHeroFrames(video,recover,()=>true);
 jest.advanceTimersByTime(6000);
 expect(recover).not.toHaveBeenCalled();stop();
});

test('long buffering offers a smaller rendition once without reloading the decoder',()=>{
 const recover=jest.fn(), fallback=jest.fn();let allowed=true;
 const video={readyState:2,networkState:2,paused:false,currentTime:14};
 const stop=watchHeroFrames(video,recover,()=>allowed,fallback);
 allowed=false;jest.advanceTimersByTime(12000);expect(fallback).not.toHaveBeenCalled();
 allowed=true;jest.advanceTimersByTime(9000);expect(fallback).toHaveBeenCalledTimes(1);
 jest.advanceTimersByTime(12000);expect(fallback).toHaveBeenCalledTimes(1);
 expect(recover).not.toHaveBeenCalled();stop();
});
