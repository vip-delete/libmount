; fill zeros from current to the given offset
%define ZEROS(offset) times offset - ($-$$) db 0

[BITS 16]
[ORG 0x7C00]

    jmp short .boot ; jmpBoot[0]=0xEB, jmpBoot[1]=0x??
    nop             ; jmpBoot[3]=0x90
    ZEROS(BootOffset)
.boot:
    push cs
    pop ds          ; save cs to ds
    mov si, msg     ; pointer to the string
    mov ah, 0x0E    ; int 10h/0Eh: print character
.loop:
    lodsb           ; same as mov al, [ds:si]
    test al, al     ; if al is 0
    jz .done        ; jump to .done
    int 0x10        ; display the character
    jmp .loop       ; next character
.done:
    xor ax, ax      ; int 16h/0: wait for any key
    int 16h
    int 19h         ; restart
    jmp $           ; loop indefinitely
msg db 0
    ZEROS(510)
    dw 0xAA55
