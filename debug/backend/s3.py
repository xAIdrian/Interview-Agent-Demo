import os
import boto3
from botocore.exceptions import ClientError

def create_bucket_if_not_exists(bucket_name, region=None):
    """
    Create an S3 bucket if it doesn't already exist.
    """
    s3 = boto3.client('s3', region_name=region)
    
    # Check if bucket exists
    try:
        s3.head_bucket(Bucket=bucket_name)
        print(f"Bucket '{bucket_name}' already exists!")
    except ClientError as e:
        error_code = int(e.response['Error']['Code'])
        if error_code == 404:
            # Bucket does not exist, create it
            if region is None:
                s3.create_bucket(Bucket=bucket_name)
            else:
                s3.create_bucket(
                    Bucket=bucket_name,
                    CreateBucketConfiguration={'LocationConstraint': region}
                )
            print(f"Bucket '{bucket_name}' has been created in region '{region}'.")
        else:
            print(f"Error checking bucket: {e}")
            raise

def upload_test_file(bucket_name, object_name="test_upload.txt", content="Hello from Gulpin!"):
    """
    Upload a small text file (or any string) to confirm S3 operations.
    """
    s3 = boto3.resource('s3')

    try:
        object = s3.Object(bucket_name, object_name)
        object.put(Body=content.encode('utf-8'))  # encode string to bytes
        print(f"Successfully uploaded '{object_name}' to bucket '{bucket_name}'!")
    except ClientError as e:
        print(f"Error uploading file to S3: {e}")
        raise

def main():
    # Name your S3 bucket here
    bucket_name = "gulpin-database"
    
    # Optional region specification (if needed)
    # region = "us-east-1"
    region = None  # Or set your desired region

    # 1. Create bucket if it doesn't exist
    create_bucket_if_not_exists(bucket_name, region)

    # 2. Upload a test file (string content) to confirm everything is working
    upload_test_file(bucket_name, "test_upload.txt", "Hello from Gulpin S3 test!")

if __name__ == "__main__":
    main()
