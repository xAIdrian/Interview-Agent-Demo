import whisper

def main():
    # Load the Whisper model
    # Options include: tiny, base, small, medium, large
    # (Models vary in size and accuracy/speed trade-offs)
    model = whisper.load_model("base")

    # Transcribe your audio file
    result = model.transcribe("sample_audio.wav")

    # Print the transcribed text
    print("Transcription:")
    print(result["text"])

if __name__ == "__main__":
    main()
