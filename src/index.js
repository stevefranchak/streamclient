import {MediaPlayer} from 'dashjs';
import {fetchMpd} from 'dash-mpd-parser';
import request from 'then-request';

let getLatestMpdFile = () => {
    return new Promise( (resolve, reject) => {
        request('GET', '/stream/api/mpd')
            .getBody('utf8')
            .then(JSON.parse)
            .then( res => {
                resolve(res);
            })
            .catch( err => {
                reject(err);
            });
    });
};

const player = dashjs.MediaPlayer().create();
player.getDebug().setLogToBrowserConsole(false);
player.initialize();
player.setAutoPlay(true);
//player.useSuggestedPresentationDelay(true); // TODO: look into this more
player.attachView(document.querySelector('video'));

// Being a bad person for now and using global vars for state
let isPlaying = false;
let currentFile = null;

player.on(MediaPlayer.events['PLAYBACK_ENDED'], () => {
    isPlaying = false;
});

player.on(MediaPlayer.events['CAN_PLAY'], () => {
    console.log('CAN_PLAY');
    player.play();
});

let checkMpdFile = (file) => {
    return new Promise( (resolve, reject) => {
        fetchMpd(file, mpd => {
            console.log(mpd);
            if (mpd && mpd.Period && mpd.Period.AdaptationSet instanceof Array &&
                mpd.Period.AdaptationSet.length && mpd.Period.AdaptationSet[0] &&
                mpd.Period.AdaptationSet[0].Representation &&
                mpd.Period.AdaptationSet[0].Representation.SegmentTemplate &&
                mpd.Period.AdaptationSet[0].Representation.SegmentTemplate.SegmentTimeline &&
                typeof mpd.Period.AdaptationSet[0].Representation.SegmentTemplate.SegmentTimeline !== 'string') {
                return resolve(mpd);
            }
            reject();
        });
    });
};

const WAIT_TIME = 5000; // 5000 ms
let tick = () => {
    if (!isPlaying) {
        getLatestMpdFile().then( res => {
            let file = res.file;
            if (typeof file !== 'undefined' && file !== null && file !== currentFile) {
                let didFileChange = file !== currentFile;
                checkMpdFile(file).then( mpd => {
                    player.attachSource(file);
                    //if (!didFileChange) {console.log('seeking');player.seek(9999999);} // this is a hack for now because player.duration() is returning NaN
                    isPlaying = true;
                    currentFile = file;
                    setTimeout(tick, WAIT_TIME);
                }).catch( () => {
                    setTimeout(tick, WAIT_TIME / 2);
                });
            } else {
                setTimeout(tick, WAIT_TIME);
            }
        }).catch( err => {
            console.error(err);
            setTimeout(tick, WAIT_TIME);
        });
    } else {
        setTimeout(tick, WAIT_TIME);
    }
};

// kick off state checker
tick();
