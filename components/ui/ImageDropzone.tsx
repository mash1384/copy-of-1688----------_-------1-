import * as React from 'react';
import { useState, useCallback } from 'react';
import { UploadIcon } from '../icons/Icons';

interface ImageDropzoneProps {
    imageUrl: string | null;
    onImageChange: (base64: string) => void;
}

const ImageDropzone: React.FC<ImageDropzoneProps> = ({ imageUrl, onImageChange }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFile = (file: File) => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                onImageChange(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            alert('이미지 파일만 업로드 가능합니다.');
        }
    };

    const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }, []);

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    return (
        <div>
            <input
                type="file"
                id="image-upload"
                className="hidden"
                accept="image/*"
                onChange={onFileSelect}
            />
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => document.getElementById('image-upload')?.click()}
                className={`w-full p-4 border-2 border-dashed rounded-lg cursor-pointer flex justify-center items-center transition-colors
                    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
                style={{ height: '150px' }}
            >
                {imageUrl ? (
                    <img src={imageUrl} alt="미리보기" className="max-h-full max-w-full object-contain rounded-md" />
                ) : (
                    <div className="text-center text-gray-500">
                        <UploadIcon className="mx-auto h-8 w-8 text-gray-400" />
                        <p className="mt-2 text-sm">이미지를 끌어다 놓거나 클릭하여 업로드하세요</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageDropzone;