import { FileIcon } from "lucide-react";

export const FILE_TYPE_ICONS: Record<string, string> = {
  xlsx: '/icons/excel.png',
  xls: '/icons/excel.png',
  csv: '/icons/excel.png',
  docx: '/icons/word.png',
  doc: '/icons/word.png',
  pdf: '/icons/pdf.png',
  pptx: '/icons/powerpoint.png',
  ppt: '/icons/powerpoint.png',
  mp3: '/icons/audio.png',
  wav: '/icons/audio.png',
  ogg: '/icons/audio.png',
  m4a: '/icons/audio.png',
  audio: '/icons/audio.png'
};

export function getFileIcon(fileType: string = '', fileName: string = '') {
    let ext = (fileName.split('.').pop() || '').toLowerCase();
    if (!ext || ext === fileName.toLowerCase()) {
        ext = (fileType.split('/').pop() || fileType).toLowerCase();
    }
    
    if (FILE_TYPE_ICONS[ext]) {
        return { 
            imageSrc: FILE_TYPE_ICONS[ext], 
            color: '', 
            bg: 'bg-transparent' 
        };
    }

    return { 
        Icon: FileIcon, 
        color: 'text-primary', 
        bg: 'bg-primary/20' 
    };
}
