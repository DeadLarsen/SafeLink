#!/usr/bin/env python3
"""
Генератор иконок для SafeLink расширения
Создает простые иконки разных размеров с щитом и текстом
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    # Создаем изображение
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Цвета
    shield_color = '#667eea'  # Основной цвет SafeLink
    accent_color = '#5a6fd8'
    text_color = '#ffffff'
    
    # Рисуем щит
    margin = size // 8
    shield_width = size - 2 * margin
    shield_height = int(shield_width * 1.2)
    
    # Координаты щита
    shield_x = margin
    shield_y = margin
    
    # Создаем форму щита
    shield_points = [
        (shield_x + shield_width // 2, shield_y),  # Верх
        (shield_x + shield_width, shield_y + shield_height // 3),  # Правый верх
        (shield_x + shield_width, shield_y + 2 * shield_height // 3),  # Правый низ
        (shield_x + shield_width // 2, shield_y + shield_height),  # Низ
        (shield_x, shield_y + 2 * shield_height // 3),  # Левый низ
        (shield_x, shield_y + shield_height // 3),  # Левый верх
    ]
    
    # Рисуем щит
    draw.polygon(shield_points, fill=shield_color, outline=accent_color, width=2)
    
    # Добавляем символ безопасности (галочка или замок)
    if size >= 48:
        # Рисуем галочку для больших иконок
        check_size = size // 4
        check_x = shield_x + shield_width // 2 - check_size // 2
        check_y = shield_y + shield_height // 2 - check_size // 2
        
        # Линии галочки
        check_points = [
            (check_x, check_y + check_size // 2),
            (check_x + check_size // 2, check_y + check_size),
            (check_x + check_size, check_y)
        ]
        
        for i in range(len(check_points) - 1):
            draw.line([check_points[i], check_points[i + 1]], 
                     fill=text_color, width=max(2, size // 16))
    else:
        # Простая точка для маленьких иконок
        dot_size = size // 8
        dot_x = shield_x + shield_width // 2 - dot_size // 2
        dot_y = shield_y + shield_height // 2 - dot_size // 2
        draw.ellipse([dot_x, dot_y, dot_x + dot_size, dot_y + dot_size], 
                    fill=text_color)
    
    return img

def main():
    # Размеры иконок для Chrome расширения
    sizes = [16, 48, 128]
    
    for size in sizes:
        icon = create_icon(size)
        filename = f'icon{size}.png'
        icon.save(filename)
        print(f'Создана иконка: {filename}')

if __name__ == '__main__':
    main() 