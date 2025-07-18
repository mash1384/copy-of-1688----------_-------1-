import * as React from 'react';
import { useState, useCallback } from 'react';
import { UploadIcon } from '../icons/Icons';

interface ImageDropzoneProps {
    imageUrl: string | null;
    onImageChange: (imageUrl: string) => void;
}

const ImageDropzone: React.FC<ImageDropzoneProps> = ({ imageUrl, onImageChange }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
    const [urlInput, setUrlInput] = useState('');

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

    const handleUrlSubmit = () => {
        if (urlInput.trim()) {
            // URL 유효성 간단 체크
            try {
                new URL(urlInput);
                onImageChange(urlInput.trim());
                setUrlInput('');
            } catch {
                alert('올바른 URL을 입력해주세요.');
            }
        }
    };

    const handleUrlKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleUrlSubmit();
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

    const clearImage = () => {
        onImageChange('');
        setUrlInput('');
    };

    return (
        <div className="space-y-4">
            {/* 모드 선택 탭 */}
            <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        inputMode === 'upload' 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                    📁 파일 업로드
                </button>
                <button
                    type="button"
                    onClick={() => setInputMode('url')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        inputMode === 'url' 
                            ? 'bg-white text-gray-900 shadow-sm' 
                            : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                    🔗 URL 입력
                </button>
            </div>

            {/* 이미지 미리보기 영역 */}
            <div className="relative">
                {imageUrl ? (
                    <div className="relative">
                        <img 
                            src={imageUrl} 
                            alt="상품 이미지 미리보기" 
                            className="w-full h-48 object-cover rounded-lg border border-gray-300"
                            onError={(e) => {
                                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlDQTNBRiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuydtOuvuOyngCDroZzrk5zsl6Dsl4A8L3RleHQ+PC9zdmc+';
                                alert('이미지를 불러올 수 없습니다. URL을 확인해주세요.');
                            }}
                        />
                        <button
                            type="button"
                            onClick={clearImage}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                        >
                            ×
                        </button>
                    </div>
                ) : (
                    <>
                        {inputMode === 'upload' ? (
                            <>
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
                                    className={`w-full p-8 border-2 border-dashed rounded-lg cursor-pointer flex flex-col justify-center items-center transition-colors h-48
                                        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}`}
                                >
                                    <UploadIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                                    <p className="text-gray-600 font-medium mb-2">이미지 파일을 업로드하세요</p>
                                    <p className="text-sm text-gray-500 text-center">
                                        파일을 끌어다 놓거나 클릭하여 선택하세요<br />
                                        JPG, PNG, GIF 파일 지원
                                    </p>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        onKeyPress={handleUrlKeyPress}
                                        placeholder="https://example.com/image.jpg"
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleUrlSubmit}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
                                    >
                                        적용
                                    </button>
                                </div>
                                <div className="bg-gray-50 rounded-lg p-4 h-32 flex items-center justify-center border-2 border-dashed border-gray-300">
                                    <div className="text-center text-gray-500">
                                        <span className="text-2xl mb-2 block">🔗</span>
                                        <p className="text-sm">이미지 URL을 입력하고 적용 버튼을 클릭하세요</p>
                                        <p className="text-xs text-gray-400 mt-1">1688, 타오바오 등의 이미지 링크 사용 가능</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 도움말 */}
            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                <p className="font-medium text-blue-800 mb-1">💡 이미지 등록 팁</p>
                <ul className="space-y-1 text-blue-700">
                    <li>• <strong>파일 업로드:</strong> 컴퓨터에 저장된 이미지 파일을 직접 업로드</li>
                    <li>• <strong>URL 입력:</strong> 1688, 타오바오 등의 이미지 링크를 복사해서 사용</li>
                    <li>• 1688에서 이미지 우클릭 → "이미지 주소 복사"로 URL 획득 가능</li>
                </ul>
            </div>
        </div>
    );
};

export default ImageDropzone;