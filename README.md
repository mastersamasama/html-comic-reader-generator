# html-comic-reader-generator
  - **application design for personal usage**<br>
  - **generate a drop-down comic reader for image in one or more than one folder automatically**

## Requirements
    python 3.x
    
## Run
### Method 1
   **enter the directory of htmlc.py(change the name as you like) with cmd and enter :**

 ```python htmlc.py```
    
### Method 2
  **just open htmlc.exe**
  
## Process

>when execute

 ```Enter the path(press enter to exit)>```
    
>enter the path where the comic was saved with keyboard or just drag the root folder into terminal

**done**
 
 
 
 ## Demonstration
 
 ```
comicdemo
  │  01.jpg
  │  02.jpg
  │  03.jpg
  │  04.jpg
  │  09.jpg
  │  10.jpg
  │  11.jpg
  │  
  └─chapter2
       │ 01.jpg
       │ 02.jpg
       │ 03.jpg
       │ 04.png
       │ 09.jpg
       │ 10.jpg
       │ 12.jpg
```
### Run

```
Enter the path(press enter to exit)> C:/comicdemo
generate C:/comicdemo/index-mobile.html completed
```

### result

 ```
comicdemo
  │  01.jpg
  │  02.jpg
  │  03.jpg
  │  04.jpg
  │  09.jpg
  │  10.jpg
  │  11.jpg
  │  index-mobile.html
  │  
  └─chapter2
       │ 01.jpg
       │ 02.jpg
       │ 03.jpg
       │ 04.png
       │ 09.jpg
       │ 10.jpg
       │ 12.jpg
```

#### Content of index-mobile.html

```
<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>user</title>
        <style>
    *, *::after, *::before {
        box-sizing: border-box;
    }

    img {
        vertical-align: middle;
    }

    html, body {
        display: flex;
        background-color: #e8e6e6;
        height: 100%;
        width: 100%;
        padding: 0;
        margin: 0;
        font-family: sans-serif;
    }

    #list {
        height: 100%;
        overflow: auto;
        width: 100%;
        text-align: center;
    }

    #list img {
        width: 98%;
        padding: 2px;
        cursor: pointer;
    }

    #list img.current {
        background: #0003;
    }


    #dest {
        height: 100%;
        width: 100%;
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
    }

    #page-num {
        position: fixed;
        font-size: 18pt;
        left: 10px;
        bottom: 5px;
        font-weight: bold;
        opacity: 0.75;
        text-shadow: /* Duplicate the same shadow to make it very strong */
            0 0 2px #222,
            0 0 2px #222,
            0 0 2px #222;
    }
        </style>
    </head>
    <body>

    <nav id="list">
    <img src="01.jpg" class="image-item"/>
<img src="02.jpg" class="image-item"/>
<img src="03.jpg" class="image-item"/>
<img src="04.jpg" class="image-item"/>
<img src="09.jpg" class="image-item"/>
<img src="10.jpg" class="image-item"/>
<img src="11.jpg" class="image-item"/>
<img src="chapter2/01.jpg" class="image-item"/>
<img src="chapter2/02.jpg" class="image-item"/>
<img src="chapter2/03.jpg" class="image-item"/>
<img src="chapter2/04.jpg" class="image-item"/>
<img src="chapter2/09.jpg" class="image-item"/>
<img src="chapter2/10.jpg" class="image-item"/>
<img src="chapter2/12.jpg" class="image-item"/>
</nav>
    </body>
    </html>
 ```
