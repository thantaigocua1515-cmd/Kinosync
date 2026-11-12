import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseTimestampToSeconds,
  formatSrtTimestamp,
  parseSrtOrTextToSubtitles,
  exportSubtitlesToSrt,
  matchImagesToTimeline,
  getRenderStateAtTime,
  getResolutionDimensions,
  BUILTIN_STOCK_LIBRARY,
  DEFAULT_DEMO_SUBTITLES_SRT,
} from './video-engine';

test('parseTimestampToSeconds handles SRT and MM:SS formats accurately', () => {
  assert.equal(parseTimestampToSeconds('00:01:05,500'), 65.5);
  assert.equal(parseTimestampToSeconds('02:10.25'), 130.25);
  assert.equal(parseTimestampToSeconds('15'), 15);
});

test('formatSrtTimestamp formats seconds into valid SRT timestamp', () => {
  assert.equal(formatSrtTimestamp(65.5), '00:01:05,500');
  assert.equal(formatSrtTimestamp(0), '00:00:00,000');
});

test('parseSrtOrTextToSubtitles parses standard SRT blocks and plain text', () => {
  const fromSrt = parseSrtOrTextToSubtitles(DEFAULT_DEMO_SUBTITLES_SRT, 24);
  assert.equal(fromSrt.length, 5);
  assert.equal(fromSrt[0].startTime, 0);
  assert.equal(fromSrt[0].endTime, 4.8);
  assert.ok(fromSrt[0].text.includes('bình minh'));

  const plainText = `Khởi đầu ngày mới trên đỉnh núi.\nThành phố lên đèn rực rỡ.\nSóng biển vỗ bờ cát.`;
  const fromPlain = parseSrtOrTextToSubtitles(plainText, 15);
  assert.equal(fromPlain.length, 3);
  assert.equal(fromPlain[0].startTime, 0);
  assert.equal(fromPlain[2].endTime, 15);
});

test('matchImagesToTimeline automatically selects semantic stock illustrations when no images are uploaded', () => {
  const subs = parseSrtOrTextToSubtitles(DEFAULT_DEMO_SUBTITLES_SRT, 24);
  const scenes = matchImagesToTimeline(
    subs,
    [],
    BUILTIN_STOCK_LIBRARY,
    24,
    'zoom-cut'
  );

  assert.equal(scenes.length, 5);
  assert.equal(scenes[0].source, 'library');
  assert.equal(scenes[0].transition, 'zoom-cut');
  // Scene 1 mentions "bình minh" & "núi" -> should match stock-nature-sunrise
  assert.ok(scenes[0].imageUrl.includes('scene_nature_sunrise'));
  // Scene 2 mentions "thành phố" & "công nghệ" -> should match stock-urban-night
  assert.ok(scenes[1].imageUrl.includes('scene_urban_night'));
  // Scene 3 mentions "cà phê" & "câu chuyện" -> should match stock-creative-workspace
  assert.ok(scenes[2].imageUrl.includes('scene_creative_workspace'));
  // Scene 4 mentions "rừng" & "thiên nhiên" -> should match stock-forest-path
  assert.ok(scenes[3].imageUrl.includes('scene_forest_path'));
  // Scene 5 mentions "sóng biển" & "hoàng hôn" -> should match stock-ocean-waves
  assert.ok(scenes[4].imageUrl.includes('scene_ocean_waves'));
});

test('getRenderStateAtTime computes transition state and active karaoke word index', () => {
  const subs = parseSrtOrTextToSubtitles(DEFAULT_DEMO_SUBTITLES_SRT, 24);
  const scenes = matchImagesToTimeline(subs, [], BUILTIN_STOCK_LIBRARY, 24, 'crossfade');

  // At t = 5.0s (0.2s into scene 2 which starts at 4.8s, with 0.8s transition duration)
  const state = getRenderStateAtTime(5.0, scenes, subs, 0.8);
  assert.equal(state.activeSceneIndex, 1);
  assert.equal(state.isTransitioning, true);
  assert.equal(state.transitionProgress, 0.25);
  assert.ok(state.activeSubtitle);
  assert.ok(state.activeWordIndex >= 0);

  const exported = exportSubtitlesToSrt(subs);
  assert.ok(exported.includes('00:00:04,800 --> 00:00:09,600'));
});

test('getResolutionDimensions returns even high-definition dimensions for MP4 encoding', () => {
  assert.deepEqual(getResolutionDimensions('1080p', '16:9'), {
    width: 1920,
    height: 1080,
  });
  assert.deepEqual(getResolutionDimensions('720p', '9:16'), {
    width: 720,
    height: 1280,
  });
});
