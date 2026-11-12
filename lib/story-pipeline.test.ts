import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleNarrationTimeline,
  buildChapterSrt,
  buildImagePool,
  buildStoryScenes,
  buildSubtitlesForChunk,
  chunkChapterText,
  estimateSession,
  formatDuration,
  layoutNarration,
  splitIntoSentences,
  type ChapterNarration,
} from './story-pipeline';
import {BUILTIN_STOCK_LIBRARY} from './video-engine';

const SAMPLE_CHAPTER = `Thanh Hà huyện, Hắc Thủy Loan.

Cuối thu, sương lạnh thấu xương. Trời còn chưa sáng, Hứa Thanh đã theo nhị thúc ra bến thuyền. Gió sông mang theo mùi tanh của cá và bùn.

"Tầng đáy thì phải mục nát trong bùn lầy?" Hắn siết chặt nắm tay, nhìn về phía chân trời.`;

test('splitIntoSentences keeps Vietnamese punctuation together', () => {
  const sentences = splitIntoSentences(
    'Hắn đi. Rồi hắn dừng lại! Thật sao? Đúng vậy…'
  );
  assert.equal(sentences.length, 4);
  assert.equal(sentences[0], 'Hắn đi.');
  assert.equal(sentences[3], 'Đúng vậy…');
});

test('chunkChapterText keeps chunks under the limit and never loses text', () => {
  const long = Array.from({length: 40}, () => SAMPLE_CHAPTER).join('\n\n');
  const chunks = chunkChapterText(long, 300);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.ok(chunk.length <= 300, `chunk quá dài: ${chunk.length}`);
  }

  const joined = chunks.join(' ').replace(/\s+/g, ' ').trim();
  const expected = long.replace(/\s+/g, ' ').trim();
  assert.equal(joined, expected);
});

test('estimateSession maps word count to a 60–90 minute film', () => {
  const chapters = Array.from({length: 14}, (_, index) => ({
    chapterNumber: index + 1,
    title: `Chương ${index + 1}`,
    wordCount: 900,
  }));
  const estimate = estimateSession(chapters);

  assert.equal(estimate.chapters, 14);
  assert.equal(estimate.words, 12600);
  assert.ok(estimate.estimatedMinutes >= 60, `quá ngắn: ${estimate.estimatedMinutes}`);
  assert.ok(estimate.estimatedMinutes <= 90, `quá dài: ${estimate.estimatedMinutes}`);
  assert.ok(estimate.chunks > 100);
});

test('estimateSession falls back to the average chapter length when wordCount is unreliable', () => {
  // API nguồn trả wordCount = số đoạn văn (41) chứ không phải số từ.
  const chapters = Array.from({length: 14}, (_, index) => ({
    chapterNumber: index + 1,
    title: `Chương ${index + 1}`,
    wordCount: 41,
  }));
  const estimate = estimateSession(chapters);

  assert.ok(estimate.estimatedMinutes >= 60);
  assert.ok(estimate.estimatedMinutes <= 90);
  assert.ok(estimate.chunks >= 120);
});

test('buildSubtitlesForChunk fills the chunk duration without gaps', () => {
  const subtitles = buildSubtitlesForChunk(
    'Câu một ngắn. Câu hai dài hơn một chút để kiểm tra tỉ lệ chia thời gian.',
    10,
    12
  );

  assert.equal(subtitles.length, 2);
  assert.equal(subtitles[0].startTime, 10);
  assert.equal(subtitles[1].endTime, 22);
  assert.equal(subtitles[0].endTime, subtitles[1].startTime);
});

test('layoutNarration places chapters and gaps consistently', () => {
  const chapters: ChapterNarration[] = [
    {chapterNumber: 1, title: 'Một', chunks: [{text: 'a', durationSec: 10}]},
    {
      chapterNumber: 2,
      title: 'Hai',
      chunks: [
        {text: 'b', durationSec: 5},
        {text: 'c', durationSec: 5},
      ],
    },
  ];

  const layout = layoutNarration(chapters, {gapSec: 2, leadInSec: 1});

  assert.equal(layout.chunks[0].startTime, 1);
  assert.equal(layout.chunks[1].startTime, 13);
  assert.equal(layout.chunks[2].startTime, 18);
  assert.deepEqual(layout.markers[0].startTime, 1);
  assert.deepEqual(layout.markers[0].endTime, 11);
  assert.deepEqual(layout.markers[1].startTime, 13);
  assert.ok(layout.durationSec > 23);
});

test('assembleNarrationTimeline produces subtitles and a valid SRT', () => {
  const chapters: ChapterNarration[] = [
    {
      chapterNumber: 1,
      title: 'Một',
      chunks: [{text: 'Câu đầu tiên. Câu thứ hai.', durationSec: 8}],
    },
  ];

  const assembly = assembleNarrationTimeline(chapters);
  assert.equal(assembly.subtitles.length, 2);
  assert.equal(assembly.markers.length, 1);

  const srt = buildChapterSrt(assembly.subtitles);
  assert.match(srt, /1\n00:00:01,200 --> /);
  assert.ok(srt.includes('Câu đầu tiên.'));
});

test('buildStoryScenes covers every chapter with an illustration', () => {
  const chapters: ChapterNarration[] = [
    {
      chapterNumber: 1,
      title: 'Một',
      chunks: [
        {
          text: 'Bình minh trên đỉnh núi. Thành phố lên đèn rực rỡ. Sóng biển vỗ bờ.',
          durationSec: 60,
        },
      ],
    },
  ];

  const assembly = assembleNarrationTimeline(chapters);
  const pool = buildImagePool(BUILTIN_STOCK_LIBRARY, {
    coverUrl: 'https://example.com/cover.jpg',
    novelTitle: 'Truyện thử',
  });
  const scenes = buildStoryScenes(assembly.subtitles, assembly.markers, pool, {
    targetSceneSeconds: 15,
  });

  assert.ok(scenes.length >= 2);
  assert.ok(scenes.every((scene) => Boolean(scene.imageUrl)));
  assert.ok(scenes[0].startTime >= assembly.markers[0].startTime);
});

test('formatDuration renders minutes and hours', () => {
  assert.equal(formatDuration(90), '1:30');
  assert.equal(formatDuration(3600), '1g 00p');
  assert.equal(formatDuration(5400), '1g 30p');
});
