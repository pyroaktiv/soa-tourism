package com.soa.blog_service.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Comment {

    private String authorId;

    private LocalDateTime createdAt;
    private LocalDateTime lastModifiedAt;

    private String text;
}