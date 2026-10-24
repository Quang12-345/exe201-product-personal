from src.services import youtube


def test_extract_video_id_variants():
    cases = {
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ": "dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ?si=x": "dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ": "dQw4w9WgXcQ",
        "https://www.youtube.com/watch?list=PL&v=dQw4w9WgXcQ&t=10s": "dQw4w9WgXcQ",
    }
    for url, vid in cases.items():
        assert youtube.is_youtube_url(url) is True
        assert youtube.extract_video_id(url) == vid


def test_non_youtube_url():
    assert youtube.is_youtube_url("https://example.com/page") is False
    assert youtube.extract_video_id("") is None


def test_format_timestamp():
    assert youtube.format_timestamp(0) == "00:00"
    assert youtube.format_timestamp(75) == "01:15"
    assert youtube.format_timestamp(3725) == "1:02:05"


def test_build_transcript_chunks_keeps_start_time():
    segments = [
        {"text": "xin chào", "start": 0.0, "duration": 2},
        {"text": "a" * 900, "start": 5.0, "duration": 3},
        {"text": "phần sau", "start": 130.0, "duration": 2},
    ]
    chunks = youtube.build_transcript_chunks(segments)
    assert len(chunks) == 2
    assert chunks[0]["start_seconds"] == 0.0
    assert chunks[1]["start_seconds"] == 130.0
    assert "phần sau" in chunks[1]["content"]


def test_empty_segments():
    assert youtube.build_transcript_chunks([]) == []


def test_parse_vtt():
    raw_vtt = """WEBVTT

1
00:00:01.000 --> 00:00:04.200 align:start position:0%
Xin chào các bạn

2
00:00:05.100 --> 00:00:08.500
Đây là một <c>đoạn</c> kiểm tra
"""
    parsed = youtube._parse_vtt(raw_vtt)
    assert len(parsed) == 2
    assert parsed[0]["text"] == "Xin chào các bạn"
    assert abs(parsed[0]["start"] - 1.0) < 1e-3
    assert abs(parsed[0]["duration"] - 3.2) < 1e-3

    assert parsed[1]["text"] == "Đây là một đoạn kiểm tra"
    assert abs(parsed[1]["start"] - 5.1) < 1e-3
    assert abs(parsed[1]["duration"] - 3.4) < 1e-3
