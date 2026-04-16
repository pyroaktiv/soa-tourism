package com.soa.blog_service.model;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "blogs")
public class Blog {

    @Id
    private String id;

    private String authorId;

    private String title;

    private String description;

    private LocalDateTime creationDate;

    private List<String> images = new ArrayList<>();

    private List<Comment> comments = new ArrayList<>();

    private List<String> likedByUserIds = new ArrayList<>();
}
