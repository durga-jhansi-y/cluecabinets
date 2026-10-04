from pathlib import Path

from app.integrations.llm.client import describe_images

FRAME_COUNT = 5    # how many still frames to take from the clip
FRAME_WIDTH = 960  # shrink frames to this width before sending them

INSTRUCTIONS = """These are {count} still frames taken in order from one video clip, at these moments: {moments}. Describe the clip for an evidence file. Write plain factual sentences.

Include:
- the setting, the lighting, and the kind of camera if that can be seen
- any on-screen text exactly as written: camera names, dates, timestamps
- vehicles and objects, with colours and distinguishing details
- people only by what is visible: how many, their clothing, what they are doing
- tattoos and marks: the design as specifically as it can be seen, and where on the body
- what changes between the first frame and the last: movement and direction

Rules:
- Left and right: say whether a body part is the person's left or right only when the frames make it clear, and say how you know. For example, when a person is seen from behind, the arm on the left side of the picture is their left arm. If it cannot be told, say so.
- Do not identify any person, and do not guess anyone's name, identity, age or background.
- Do not guess at things that cannot be seen. If something is unclear, say it is unclear.
- Do not interpret what the clip means for a case. Describe only.
"""


def extract_text(path: Path) -> str:
    """Take a few still frames from a video and ask the AI to describe them."""
    try:
        import cv2
    except ImportError:
        raise RuntimeError(
            "Video support needs OpenCV. Run: pip install opencv-python-headless"
        )

    capture = cv2.VideoCapture(str(path))
    try:
        if not capture.isOpened():
            raise ValueError("The video could not be opened")

        total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        frames_per_second = capture.get(cv2.CAP_PROP_FPS) or 0
        if total_frames <= 0 or frames_per_second <= 0:
            raise ValueError("The video has no readable frames")
        duration = total_frames / frames_per_second

        # Pick frames spread evenly through the clip.
        positions = [
            int(total_frames * (index + 0.5) / FRAME_COUNT) for index in range(FRAME_COUNT)
        ]

        frames = []
        moments = []
        for position in positions:
            capture.set(cv2.CAP_PROP_POS_FRAMES, position)
            success, frame = capture.read()
            if not success:
                continue

            # Shrink large frames so the request stays small and fast.
            height, width = frame.shape[:2]
            if width > FRAME_WIDTH:
                new_height = int(height * FRAME_WIDTH / width)
                frame = cv2.resize(frame, (FRAME_WIDTH, new_height))

            success, encoded = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            if success:
                frames.append((encoded.tobytes(), "image/jpeg"))
                moments.append(f"{position / frames_per_second:.1f}s")
    finally:
        capture.release()

    if not frames:
        raise ValueError("No frames could be read from the video")

    instructions = INSTRUCTIONS.format(count=len(frames), moments=", ".join(moments))
    description = describe_images(frames, instructions)
    return (
        f"Video clip, about {duration:.0f} seconds long. "
        f"Description based on {len(frames)} still frames: " + description.strip()
    )
